import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/design/auth_parts.dart';
import '../../../../core/design/rich/v15_pulse_skeleton.dart';
import '../../../../core/design/v15_widgets.dart';
import '../../../../injection_container.dart';
import '../../../business/domain/entities/business.dart';
import '../../domain/entities/shelf_scan.dart';
import '../../domain/photo_quality.dart';
import '../../domain/scan_review.dart';
import '../../domain/usecases/stocktake_usecases.dart';
import '../cubit/photo_check_cubit.dart';
import '../cubit/shelf_scan_cubit.dart';
import '../widgets/photo_check_panel.dart';
import '../widgets/scan_photo.dart';
import 'scan_review_view.dart';

/// Photo-to-inventory (PRD S2–S5): take or pick a shelf photo, run the
/// stock-take agent or the quick scan, review, confirm. Pops `true` once
/// stock changed, so the inventory reloads.
class ShelfScanPage extends StatelessWidget {
  const ShelfScanPage({super.key, required this.business});
  final Business business;

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => sl<ShelfScanCubit>(param1: business.id)),
        BlocProvider(create: (_) => sl<PhotoCheckCubit>(param1: business.id)),
      ],
      // Each new photo is checked once, so a failed or cancelled run doesn't check it again.
      child: BlocListener<ShelfScanCubit, ShelfScanState>(
        listenWhen: (a, b) => !identical(a.photo, b.photo),
        listener: (context, state) {
          final check = context.read<PhotoCheckCubit>();
          final photo = state.photo;
          photo == null ? check.reset() : check.check(photo);
        },
        child: _ShelfScanView(business: business),
      ),
    );
  }
}

class _ShelfScanView extends StatelessWidget {
  const _ShelfScanView({required this.business});
  final Business business;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return BlocBuilder<ShelfScanCubit, ShelfScanState>(
      buildWhen: (a, b) => a.runtimeType != b.runtimeType || b is! ScanReady,
      builder: (context, state) => switch (state) {
        ScanReady(:final photo, :final scan, :final fallback) => ScanReviewView(
          key: ValueKey(scan.scanId),
          business: business,
          photo: photo,
          scan: scan,
          fallback: fallback,
          onRetake: context.read<ShelfScanCubit>().retake,
        ),
        _ => Scaffold(
          backgroundColor: c.surface,
          body: SafeArea(
            child: switch (state) {
              ScanWorking() => _Working(state: state, business: business),
              ScanPicking(photo: final photo?, :final error) => _Ready(photo: photo, error: error),
              ScanPicking(:final error) => _Capture(error: error),
              ScanReady() => const SizedBox.shrink(),
            },
          ),
        ),
      },
    );
  }
}

/// The header every step shares: back (or cancel) and the step's title.
class _Header extends StatelessWidget {
  const _Header({required this.title, required this.onBack, this.backLabel = 'Back'});
  final String title;
  final VoidCallback onBack;
  final String backLabel;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
      child: Row(
        children: [
          V15IconButton(IconsOutline.alt_arrow_left, tooltip: backLabel, onPressed: onBack),
          const SizedBox(width: 4),
          Expanded(
            child: Text(title, style: V15.sectionTitle.copyWith(color: c.gray900)),
          ),
        ],
      ),
    );
  }
}

/// S2: take a photo, or pick one. image_picker scales it to a 2560 px long edge, as mp, so small products keep a usable crop.
class _Capture extends StatefulWidget {
  const _Capture({this.error});
  final String? error;

  @override
  State<_Capture> createState() => _CaptureState();
}

class _CaptureState extends State<_Capture> {
  String? _pickError;
  bool _busy = false;

  Future<void> _pick(ImageSource source) async {
    setState(() {
      _busy = true;
      _pickError = null;
    });
    try {
      final file = await ImagePicker().pickImage(
        source: source,
        maxWidth: 2560,
        maxHeight: 2560,
        imageQuality: 80,
        requestFullMetadata: false,
      );
      if (file == null || !mounted) return;
      final mime = _mimeOf(file);
      if (mime == null) {
        setState(() => _pickError = 'Use a JPEG, PNG or WebP photo.');
        return;
      }
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      context.read<ShelfScanCubit>().usePhoto(ShelfPhoto(bytes: bytes, mimeType: mime));
    } on PlatformException {
      if (!mounted) return;
      setState(
        () => _pickError = source == ImageSource.camera
            ? "The camera isn't available. Allow camera access in Settings, or choose a photo."
            : "Your photos aren't available. Allow photo access in Settings.",
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  static String? _mimeOf(XFile f) {
    final type = f.mimeType;
    if (type != null) return const {'image/jpeg', 'image/png', 'image/webp'}.contains(type) ? type : null;
    final ext = f.path.split('.').last.toLowerCase();
    return switch (ext) {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => null,
    };
  }

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final error = _pickError ?? widget.error;
    return Column(
      children: [
        _Header(title: 'Scan a shelf', onBack: () => Navigator.of(context).pop()),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              if (error != null) ...[AuthMessage(error), const SizedBox(height: 16)],
              V15Tray(
                child: V15Sheet(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
                  child: Column(
                    children: [
                      const V15IconTile(IconsOutline.camera),
                      const SizedBox(height: 16),
                      Text(
                        'One photo of a shelf, crate or pile',
                        textAlign: TextAlign.center,
                        style: V15.cardHeading.copyWith(color: c.gray900),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Tally reads every product, counts the units and matches them to Qore Catalog. You check it before anything is stocked.',
                        textAlign: TextAlign.center,
                        style: V15.description.copyWith(color: c.gray500),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const _Tips(),
            ],
          ),
        ),
        Divider(height: 1, color: c.divider),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: V15Button(
                  'Gallery',
                  icon: IconsOutline.gallery,
                  tone: V15Tone.soft,
                  height: 48,
                  expand: true,
                  onPressed: _busy ? null : () => _pick(ImageSource.gallery),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: V15Button(
                  'Take photo',
                  icon: IconsOutline.camera,
                  height: 48,
                  expand: true,
                  loading: _busy,
                  onPressed: () => _pick(ImageSource.camera),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Tips extends StatelessWidget {
  const _Tips();

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    const tips = [
      'Step back so the whole shelf fits.',
      'Labels facing the camera, in good light.',
      'Hold still: a sharp photo counts better.',
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final t in tips)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: Icon(IconsOutline.info_circle, size: 16, color: c.gray400),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(t, style: V15.description.copyWith(color: c.gray600)),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// A photo is ready: the stock-take agent (thorough) or the quick scan (fast), as mp.
class _Ready extends StatelessWidget {
  const _Ready({required this.photo, this.error});
  final ShelfPhoto photo;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final cubit = context.read<ShelfScanCubit>();
    return Column(
      children: [
        _Header(title: 'Scan a shelf', onBack: cubit.retake, backLabel: 'Use another photo'),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              if (error != null) ...[AuthMessage(error!), const SizedBox(height: 16)],
              DecodedPhoto(
                bytes: photo.bytes,
                builder: (_, image) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(V15.sheetRadius),
                      child: ScanPhotoView(image: image),
                    ),
                    // Advice only: the scan buttons below never wait on it.
                    BlocBuilder<PhotoCheckCubit, PhotoCheckState>(
                      builder: (context, check) => Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: PhotoCheckPanel(state: check, onRetake: cubit.retake),
                      ),
                    ),
                    if ((image.width > image.height ? image.width : image.height) < kSmallPhotoEdge) ...[
                      const SizedBox(height: 12),
                      const V15Notice(
                        title: kSmallPhotoWarning,
                        icon: IconsOutline.danger_circle,
                        tone: V15NoticeTone.warn,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Stock-take takes about a minute: an agent zooms into unclear labels and searches the catalogue again. '
                'Quick scan takes 15–30 seconds.',
                style: V15.description.copyWith(color: c.gray500),
              ),
              const SizedBox(height: 4),
              Align(
                alignment: Alignment.centerLeft,
                child: AuthTextAction('Use another photo', onTap: cubit.retake),
              ),
            ],
          ),
        ),
        Divider(height: 1, color: c.divider),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: V15Button(
                  'Quick scan',
                  tone: V15Tone.soft,
                  height: 48,
                  expand: true,
                  onPressed: cubit.quickScan,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: V15Button(
                  'Start stock-take',
                  icon: IconsOutline.stars,
                  height: 48,
                  expand: true,
                  onPressed: cubit.stocktake,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// S3: the photo pulsing while the models work; the agent's live step trace,
/// or the quick scan's staged copy. Cancel keeps the photo.
class _Working extends StatefulWidget {
  const _Working({required this.state, required this.business});
  final ScanWorking state;
  final Business business;

  @override
  State<_Working> createState() => _WorkingState();
}

class _WorkingState extends State<_Working> {
  late final Timer _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _tick.cancel();
    super.dispose();
  }

  /// The quick scan is one request: stage the copy by time (read ~6 s, then count and match).
  static String _quickStage(int s) => s < 8
      ? 'Finding products…'
      : s < 16
      ? 'Counting units…'
      : 'Matching to Qore Catalog…';

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final s = widget.state;
    final elapsed = DateTime.now().difference(s.startedAt).inSeconds;
    final latest = s.steps.lastOrNull;
    final headline = !s.agent
        ? _quickStage(elapsed)
        : latest == null
        ? 'First pass: reading the shelf…'
        : '${describeStep(latest).$1}…';
    return Column(
      children: [
        _Header(title: 'Scanning', onBack: context.read<ShelfScanCubit>().cancel, backLabel: 'Cancel'),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(V15.sheetRadius),
                child: Stack(
                  children: [
                    DecodedPhoto(
                      bytes: s.photo.bytes,
                      builder: (_, image) => ScanPhotoView(image: image),
                    ),
                    Positioned.fill(
                      child: V15Pulse(
                        color: Colors.white.withValues(alpha: 0.35),
                        child: const ColoredBox(color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: c.primary)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Semantics(
                      liveRegion: true,
                      child: Text(headline, style: V15.sectionTitle.copyWith(color: c.gray900)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                '${s.agent ? 'Stock-take agent' : 'Quick scan'} for ${widget.business.name} · ${elapsed}s',
                style: V15.text(13, FontWeight.w400, c.gray500, tabular: true),
              ),
              const SizedBox(height: 16),
              if (!s.agent)
                Text(
                  'Muse Spark reads every product, SAM counts the units and Qore Catalog matches them. This takes 15–30 seconds.',
                  style: V15.description.copyWith(color: c.gray600),
                )
              else if (s.steps.isEmpty)
                Text(
                  'Reading every product, counting units and matching the catalogue (about 20–30 s).',
                  style: V15.description.copyWith(color: c.gray500),
                )
              else
                _Trace(steps: s.steps),
            ],
          ),
        ),
        Divider(height: 1, color: c.divider),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: V15Button(
            'Cancel',
            tone: V15Tone.soft,
            height: 48,
            expand: true,
            onPressed: context.read<ShelfScanCubit>().cancel,
          ),
        ),
      ],
    );
  }
}

/// The agent's steps so far, newest first and accented.
class _Trace extends StatelessWidget {
  const _Trace({required this.steps});
  final List<AgentStep> steps;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final steps = this.steps.reversed.toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final (i, step) in steps.indexed)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Column(
                  children: [
                    Container(
                      margin: const EdgeInsets.only(top: 5),
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: i == 0 ? c.primary : c.gray300),
                    ),
                    if (i < steps.length - 1) Expanded(child: Container(width: 1, color: c.gray200)),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Builder(
                      builder: (context) {
                        final (title, detail) = describeStep(step);
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: step.kind == 'thought'
                                  ? V15.text(14, FontWeight.w400, c.gray600).copyWith(fontStyle: FontStyle.italic)
                                  : V15.ui.copyWith(color: c.gray900),
                            ),
                            if (detail != null) Text(detail, style: V15.text(13, FontWeight.w400, c.gray500)),
                          ],
                        );
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
