import 'package:flutter/widgets.dart';

// Design 1.5 motion — web packages/ui/src/styles/v2-motion.css on Flutter.
//
// The rules web keeps, kept here:
// - only opacity and transform animate;
// - entrances are under 300ms on a strong ease-out;
// - nothing starts from scale 0 (the smallest is 0.95, with a fade);
// - reduced motion ([V15Motion.reduced]: the platform's "reduce motion" /
//   `MediaQuery.disableAnimations`) keeps the fades and drops the movement:
//   every entrance becomes a plain 150ms fade and the ambient loops stop.
//
//   Tokens   V15Motion (durations, curves, stagger, reduced)
//   Enter    V15Rise (q-rise), V15Stagger (q-stagger), V15Pop (q-pop),
//            V15FadeIn (q-fade-in)
//   Loops    V15Float (q-float), V15Ping (q-ping)

/// Durations and curves from v2-motion.css.
abstract final class V15Motion {
  /// The reduced-motion fade every entrance turns into.
  static const Duration reducedFade = Duration(milliseconds: 150);

  /// Press feedback (q-press: scale 0.97).
  static const Duration press = Duration(milliseconds: 160);

  /// q-pop: a tag or a check appearing.
  static const Duration pop = Duration(milliseconds: 180);

  /// q-fade-in: skeleton → content.
  static const Duration fade = Duration(milliseconds: 200);

  /// q-step-fwd / q-step-back: a step arriving from the side.
  static const Duration step = Duration(milliseconds: 240);

  /// q-rise and q-sheet-up: a block arriving, a sheet rising.
  static const Duration rise = Duration(milliseconds: 280);

  /// The gap between q-stagger children.
  static const Duration staggerStep = Duration(milliseconds: 40);

  /// The delay is capped here (child 8 and later all wait 280ms).
  static const Duration staggerMax = Duration(milliseconds: 280);

  /// Palette cross-fades (GradientBackdrop `transition-colors duration-500`).
  static const Duration colorFade = Duration(milliseconds: 500);

  /// `--ease-out` cubic-bezier(0.23, 1, 0.32, 1): every entrance.
  static const Curve easeOut = Cubic(0.23, 1, 0.32, 1);

  /// `--ease-in-out` cubic-bezier(0.77, 0, 0.175, 1): q-float.
  static const Curve easeInOut = Cubic(0.77, 0, 0.175, 1);

  /// `--ease-drawer` cubic-bezier(0.32, 0.72, 0, 1): sheets.
  static const Curve drawer = Cubic(0.32, 0.72, 0, 1);

  /// CSS `ease` — q-fade-in.
  static const Curve ease = Cubic(0.25, 0.1, 0.25, 1);

  /// q-ping / Tailwind animate-ping cubic-bezier(0, 0, 0.2, 1).
  static const Curve ping = Cubic(0, 0, 0.2, 1);

  /// Tailwind animate-pulse cubic-bezier(0.4, 0, 0.6, 1): skeletons.
  static const Curve pulse = Cubic(0.4, 0, 0.6, 1);

  /// True when the platform asks for reduced motion (or a test disables
  /// animations): entrances fade, loops stop.
  static bool reduced(BuildContext context) =>
      MediaQuery.maybeDisableAnimationsOf(context) ?? false;

  /// The q-stagger delay for the child at [index] (0-based): 40ms apart,
  /// capped at 280ms from the eighth child on.
  static Duration staggerDelay(int index) {
    final ms = staggerStep.inMilliseconds * index;
    return Duration(
      milliseconds: ms.clamp(0, staggerMax.inMilliseconds).toInt(),
    );
  }
}

/// Plays one entrance on mount: [delay], then [duration] along [curve].
/// Under reduced motion it plays [V15Motion.reducedFade] with no delay and
/// [moving] false, so the builder draws a fade only.
abstract class _EntranceState<T extends StatefulWidget> extends State<T>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  bool _reduced = false;
  bool _started = false;

  /// The delay is part of the controller's run (an [Interval]), not a
  /// timer, so nothing is left pending when the widget goes away.
  double _start = 0;

  Duration get delay;
  Duration get duration;
  Curve get curve;
  Widget get child;

  /// False under reduced motion: draw the fade only.
  bool get moving => !_reduced;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _reduced = V15Motion.reduced(context);
    if (_reduced) {
      _c.duration = V15Motion.reducedFade;
      _start = 0;
    } else {
      final total = delay + duration;
      _c.duration = total;
      _start = total == Duration.zero
          ? 0
          : delay.inMicroseconds / total.inMicroseconds;
    }
    _c.forward();
  }

  /// 0 → 1 progress after the delay, eased ([V15Motion.ease] for the
  /// reduced fade).
  double get progress {
    final v = _c.value;
    if (_reduced) return V15Motion.ease.transform(v);
    if (v <= _start) return 0;
    if (_start >= 1) return 1;
    return curve.transform(((v - _start) / (1 - _start)).clamp(0.0, 1.0));
  }

  Widget buildFrame(BuildContext context, double p, Widget child);

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _c,
    child: child,
    builder: (context, child) => buildFrame(context, progress, child!),
  );

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }
}

/// q-rise: fades in and rises [offset] px (8) over 280ms on the ease-out,
/// once, when it mounts. Under reduced motion: a 150ms fade, no rise.
class V15Rise extends StatefulWidget {
  final Widget child;

  /// Wait before starting (a stagger slot; see [V15Motion.staggerDelay]).
  final Duration delay;
  final Duration duration;

  /// How far below its rest the child starts.
  final double offset;

  const V15Rise({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = V15Motion.rise,
    this.offset = 8,
  });

  @override
  State<V15Rise> createState() => _V15RiseState();
}

class _V15RiseState extends _EntranceState<V15Rise> {
  @override
  Duration get delay => widget.delay;
  @override
  Duration get duration => widget.duration;
  @override
  Curve get curve => V15Motion.easeOut;
  @override
  Widget get child => widget.child;

  @override
  Widget buildFrame(BuildContext context, double p, Widget child) {
    final faded = Opacity(opacity: p.clamp(0.0, 1.0), child: child);
    if (!moving) return faded;
    return Transform.translate(
      offset: Offset(0, widget.offset * (1 - p)),
      child: faded,
    );
  }
}

/// q-stagger: [children] in a column, each rising ([V15Rise]) 40ms after
/// the one before (capped at 280ms). [spacing] goes between children.
///
/// For a lazy list, wrap each item in a [V15Rise] with
/// `delay: V15Motion.staggerDelay(index)` instead.
class V15Stagger extends StatelessWidget {
  final List<Widget> children;
  final double spacing;
  final CrossAxisAlignment crossAxisAlignment;
  final MainAxisSize mainAxisSize;

  /// Extra wait before the first child.
  final Duration delay;

  const V15Stagger({
    super.key,
    required this.children,
    this.spacing = 0,
    this.crossAxisAlignment = CrossAxisAlignment.stretch,
    this.mainAxisSize = MainAxisSize.min,
    this.delay = Duration.zero,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: crossAxisAlignment,
      mainAxisSize: mainAxisSize,
      children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0 && spacing > 0) SizedBox(height: spacing),
          V15Rise(delay: delay + V15Motion.staggerDelay(i), child: children[i]),
        ],
      ],
    );
  }
}

/// q-pop: fades in and grows from [from] (0.95) over 180ms on the
/// ease-out — a tag, a badge or a check appearing. Under reduced motion: a
/// 150ms fade at full size.
class V15Pop extends StatefulWidget {
  final Widget child;
  final Duration delay;
  final Duration duration;
  final double from;
  final Alignment alignment;

  const V15Pop({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = V15Motion.pop,
    this.from = 0.95,
    this.alignment = Alignment.center,
  });

  @override
  State<V15Pop> createState() => _V15PopState();
}

class _V15PopState extends _EntranceState<V15Pop> {
  @override
  Duration get delay => widget.delay;
  @override
  Duration get duration => widget.duration;
  @override
  Curve get curve => V15Motion.easeOut;
  @override
  Widget get child => widget.child;

  @override
  Widget buildFrame(BuildContext context, double p, Widget child) {
    final faded = Opacity(opacity: p.clamp(0.0, 1.0), child: child);
    if (!moving) return faded;
    return Transform.scale(
      scale: widget.from + (1 - widget.from) * p,
      alignment: widget.alignment,
      child: faded,
    );
  }
}

/// q-fade-in: a plain 200ms fade (skeleton → content). Reduced motion keeps
/// it (at 150ms), as web does.
class V15FadeIn extends StatefulWidget {
  final Widget child;
  final Duration delay;
  final Duration duration;

  const V15FadeIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = V15Motion.fade,
  });

  @override
  State<V15FadeIn> createState() => _V15FadeInState();
}

class _V15FadeInState extends _EntranceState<V15FadeIn> {
  @override
  Duration get delay => widget.delay;
  @override
  Duration get duration => widget.duration;
  @override
  Curve get curve => V15Motion.ease;
  @override
  Widget get child => widget.child;

  @override
  Widget buildFrame(BuildContext context, double p, Widget child) =>
      Opacity(opacity: p.clamp(0.0, 1.0), child: child);
}

/// A looping ambient animation that stops under reduced motion (the child
/// is drawn still) and pauses with [TickerMode].
abstract class _LoopState<T extends StatefulWidget> extends State<T>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  bool _reduced = false;

  Duration get period;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: period);
  }

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

  /// Whether the loop is running (false under reduced motion).
  bool get looping => !_reduced;

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }
}

/// q-float: drifts up [distance] px (4) and back every [period] (4s) on the
/// in-out curve. Decorative: still under reduced motion.
class V15Float extends StatefulWidget {
  final Widget child;
  final double distance;
  final Duration period;

  const V15Float({
    super.key,
    required this.child,
    this.distance = 4,
    this.period = const Duration(seconds: 4),
  });

  @override
  State<V15Float> createState() => _V15FloatState();
}

class _V15FloatState extends _LoopState<V15Float> {
  @override
  Duration get period => widget.period;

  @override
  Widget build(BuildContext context) {
    if (!looping) return widget.child;
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        // 0 → 50%: rise; 50 → 100%: back, each half on the in-out curve.
        final t = _c.value;
        final half = t < 0.5 ? t / 0.5 : (1 - t) / 0.5;
        final y = -widget.distance * V15Motion.easeInOut.transform(half);
        return Transform.translate(offset: Offset(0, y), child: child);
      },
    );
  }
}

/// q-ping: a status dot with a copy behind it that grows to [scale] (2.2)
/// and fades out every [period] (1.6s) — a live / on-duty marker. Under
/// reduced motion only the still dot is drawn.
///
/// Web's StatusIndicator (team on duty) is the faster variant:
/// `V15Ping(color: …, size: 8, scale: 2, period: Duration(seconds: 1))`.
class V15Ping extends StatefulWidget {
  final Color color;

  /// The dot's diameter.
  final double size;

  /// How far the ping copy grows.
  final double scale;
  final Duration period;

  /// Screen-reader label for the status ("Live", "On duty").
  final String? semanticLabel;

  const V15Ping({
    super.key,
    required this.color,
    this.size = 12,
    this.scale = 2.2,
    this.period = const Duration(milliseconds: 1600),
    this.semanticLabel,
  });

  @override
  State<V15Ping> createState() => _V15PingState();
}

class _V15PingState extends _LoopState<V15Ping> {
  @override
  Duration get period => widget.period;

  @override
  Widget build(BuildContext context) {
    final dot = DecoratedBox(
      decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
    );
    Widget body = SizedBox.square(
      dimension: widget.size,
      child: Stack(
        clipBehavior: Clip.none,
        fit: StackFit.expand,
        children: [
          if (looping)
            AnimatedBuilder(
              animation: _c,
              child: dot,
              builder: (context, child) {
                // 0 → 75%: grow and fade on the ping curve; then rest gone.
                final p = V15Motion.ping.transform(
                  (_c.value / 0.75).clamp(0.0, 1.0),
                );
                return Opacity(
                  opacity: 1 - p,
                  child: Transform.scale(
                    scale: 1 + (widget.scale - 1) * p,
                    child: child,
                  ),
                );
              },
            ),
          dot,
        ],
      ),
    );
    if (widget.semanticLabel != null) {
      body = Semantics(label: widget.semanticLabel, child: body);
    }
    return body;
  }
}
