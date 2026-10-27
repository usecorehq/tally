#!/usr/bin/env ruby
# Wires iOS flavors into ios/Runner.xcodeproj. Idempotent — safe to re-run.
#
# For every flavor × {Debug, Profile, Release} it ensures:
#   - an Xcode build configuration "<Base>-<flavor>" (project + every target)
#   - ios/Flutter/<Base>-<flavor>.xcconfig (Pods include + Generated.xcconfig)
#   - PRODUCT_BUNDLE_IDENTIFIER / APP_DISPLAY_NAME on the Runner target
#   - a shared scheme named exactly "<flavor>" (what `flutter run --flavor` looks up)
# and a Podfile mapping each configuration to :debug / :release.
#
# Keep FLAVORS in sync with android/app/build.gradle.kts and lib/main_<flavor>.dart.
#
# Usage (from apps/mobile): ruby tool/setup_ios_flavors.rb
# Needs the xcodeproj gem (ships with CocoaPods).

require 'xcodeproj'
require 'fileutils'

BUNDLE_ID = 'com.qorelly.tally'
FLAVORS = {
  'dev'     => { suffix: '.dev',     name: 'Tally Dev' },
  'staging' => { suffix: '.staging', name: 'Tally Staging' },
  'prod'    => { suffix: '',         name: 'Tally' },
}
BASES = { 'Debug' => :debug, 'Profile' => :release, 'Release' => :release }

ios = File.expand_path('../ios', __dir__)
project_path = File.join(ios, 'Runner.xcodeproj')
project = Xcodeproj::Project.open(project_path)
runner = project.targets.find { |t| t.name == 'Runner' }
tests = project.targets.find { |t| t.name == 'RunnerTests' }
flutter_group = project.main_group.find_subpath('Flutter', false) or abort 'Flutter group not found'

def set_ids(target, config, bundle_id, display_name)
  return unless target
  bc = target.build_configuration_list[config]
  if target.name == 'Runner'
    bc.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = bundle_id
    bc.build_settings['APP_DISPLAY_NAME'] = display_name
  else
    bc.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = "#{bundle_id}.RunnerTests"
  end
end

# Unflavored configs stay buildable (they behave like prod).
BASES.each_key { |base| [runner, tests].each { |t| set_ids(t, base, BUNDLE_ID, 'Tally') } }

FLAVORS.each do |flavor, meta|
  BASES.each do |base, type|
    name = "#{base}-#{flavor}"

    xcconfig = File.join(ios, 'Flutter', "#{name}.xcconfig")
    File.write(xcconfig, <<~XC) unless File.exist?(xcconfig)
      #include? "Pods/Target Support Files/Pods-Runner/Pods-Runner.#{name.downcase}.xcconfig"
      #include "Generated.xcconfig"
    XC
    # Flutter's "Flutter" group has no path of its own; its files carry
    # "Flutter/<file>" (like Debug.xcconfig), so match that or Xcode looks in ios/.
    file_ref = flutter_group.files.find { |f| [name + '.xcconfig', "Flutter/#{name}.xcconfig"].include?(f.path) } ||
               flutter_group.new_reference("Flutter/#{name}.xcconfig")
    file_ref.path = "Flutter/#{name}.xcconfig"
    file_ref.name = "#{name}.xcconfig"

    # Project level + every target: clone the base config's settings once.
    lists = [project.build_configuration_list] + project.targets.map(&:build_configuration_list)
    lists.each do |list|
      next if list[name]
      src = list[base]
      bc = project.new(Xcodeproj::Project::Object::XCBuildConfiguration)
      bc.name = name
      bc.build_settings = Marshal.load(Marshal.dump(src.build_settings))
      bc.base_configuration_reference = src.base_configuration_reference
      list.build_configurations << bc
    end
    runner.build_configuration_list[name].base_configuration_reference = file_ref

    set_ids(runner, name, BUNDLE_ID + meta[:suffix], meta[:name])
    set_ids(tests, name, BUNDLE_ID + meta[:suffix], meta[:name])
  end
end
project.save

# Schemes: copy Runner.xcscheme, pointing each action at the flavor's configs.
schemes = File.join(project_path, 'xcshareddata', 'xcschemes')
template = File.read(File.join(schemes, 'Runner.xcscheme'))
FLAVORS.each_key do |flavor|
  xml = template.gsub(/buildConfiguration = "(Debug|Profile|Release)"/) { %(buildConfiguration = "#{$1}-#{flavor}") }
  File.write(File.join(schemes, "#{flavor}.xcscheme"), xml)
end

# Info.plist: launcher name comes from the build configuration.
plist = File.join(ios, 'Runner', 'Info.plist')
info = File.read(plist)
info.sub!(%r{(<key>CFBundleDisplayName</key>\s*<string>)[^<]*(</string>)}, '\1$(APP_DISPLAY_NAME)\2')
File.write(plist, info)

# Podfile: CocoaPods must know which configs are debug, or Debug-<flavor> builds as release.
podfile = File.join(ios, 'Podfile')
mapping = BASES.map { |b, t| "  '#{b}' => :#{t}," }
FLAVORS.each_key { |f| BASES.each { |b, t| mapping << "  '#{b}-#{f}' => :#{t}," } }
podfile_src = File.exist?(podfile) ? File.read(podfile) :
  File.read(File.join(ENV.fetch('FLUTTER_ROOT') { File.expand_path('..', File.dirname(`which flutter`.strip)) },
                      'packages', 'flutter_tools', 'templates', 'cocoapods', 'Podfile-ios'))
podfile_src.sub!(/project 'Runner', \{.*?\n\}/m, "project 'Runner', {\n#{mapping.join("\n")}\n}")
podfile_src.sub!(/^# platform :ios, '13.0'$/, "platform :ios, '13.0'")
File.write(podfile, podfile_src)

puts "iOS flavors wired: #{FLAVORS.keys.join(', ')}"
