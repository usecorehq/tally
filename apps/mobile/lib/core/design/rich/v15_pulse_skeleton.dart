import 'package:flutter/widgets.dart';

import '../v15_tokens.dart';
import 'v15_motion.dart';

// Design 1.5 skeletons — web packages/ui/src/skeleton.tsx: `animate-pulse
// rounded-md bg-gray-200/90`. V2 has no shimmer sweep anywhere; a pending
// block breathes between full and half opacity (2s,
// cubic-bezier(0.4, 0, 0.6, 1)). Under reduced motion it holds still.
//
//   V15Pulse          pulses a group: paints every opaque pixel of [child]
//                     (white V15SkeletonBlock masks) in the skeleton colour
//                     — one clock per group, like the old Shimmer parent
//   V15PulseSkeleton  one block the size of the value it stands in for

/// Tailwind animate-pulse: opacity 1 → 0.5 → 1 over 2s.
const Duration kV15PulsePeriod = Duration(seconds: 2);

/// The pulse's opacity at loop position [t] (0 → 1): 1 at both ends, 0.5 in
/// the middle, each half on the pulse curve.
double v15PulseOpacity(double t) {
  final half = t < 0.5 ? t / 0.5 : (1 - t) / 0.5;
  return 1 - 0.5 * V15Motion.pulse.transform(half.clamp(0.0, 1.0));
}

/// Pulses [child] as a skeleton group. Every opaque pixel of [child] is
/// painted in [color] (default the skeleton grey, lifted in a dark sheet),
/// so a column of white `V15SkeletonBlock`s reads as grey placeholders.
/// Still under reduced motion.
class V15Pulse extends StatefulWidget {
  final Widget child;

  /// The placeholder colour (default [V15Colors.skeletonBase]; white 20% on a
  /// photo hero).
  final Color? color;

  /// False: [child] is drawn as it is, only the opacity pulses (blocks that
  /// already carry their own colour).
  final bool recolor;

  const V15Pulse({
    super.key,
    required this.child,
    this.color,
    this.recolor = true,
  });

  @override
  State<V15Pulse> createState() => _V15PulseState();
}

class _V15PulseState extends State<V15Pulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: kV15PulsePeriod,
  );
  bool _reduced = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduced = V15Motion.reduced(context);
    if (_reduced) {
      _c.stop();
      _c.value = 0;
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color ?? V15.of(context).skeletonBase;
    Widget body = widget.child;
    if (widget.recolor) {
      body = ColorFiltered(
        colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
        child: body,
      );
    }
    if (_reduced) return body;
    return AnimatedBuilder(
      animation: _c,
      child: RepaintBoundary(child: body),
      builder: (context, child) =>
          Opacity(opacity: v15PulseOpacity(_c.value), child: child),
    );
  }
}

/// One pulsing block the size of the value it stands in for (web Skeleton:
/// gray-200, r8 here as the kit's figures use). Read as "Loading".
class V15PulseSkeleton extends StatelessWidget {
  final double? width;
  final double height;
  final double radius;
  final BoxShape shape;

  /// The block colour (default the skeleton grey; `Colors.white` at 20% on
  /// a photo hero, as web's wallet hero).
  final Color? color;

  /// Screen-reader label; null to leave it to a parent.
  final String? semanticLabel;

  const V15PulseSkeleton({
    super.key,
    this.width,
    required this.height,
    this.radius = 8,
    this.shape = BoxShape.rectangle,
    this.color,
    this.semanticLabel = 'Loading',
  });

  @override
  Widget build(BuildContext context) {
    final block = V15Pulse(
      recolor: false,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: color ?? V15.of(context).skeletonBase,
          shape: shape,
          borderRadius: shape == BoxShape.circle
              ? null
              : BorderRadius.circular(radius),
        ),
      ),
    );
    if (semanticLabel == null) return block;
    return Semantics(label: semanticLabel, child: block);
  }
}
