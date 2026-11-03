import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../../core/design/v15_widgets.dart';
import '../../../domain/entities/shelf_scan.dart';
import '../../../domain/scan_review.dart' show describeStep;
import '../../widgets/scan_photo.dart';

/// A running stock-take reopened from history: the stored photo (a rerun's, or once saved) and the agent's
/// steps, newest first.
class RunProgress extends StatefulWidget {
  const RunProgress({super.key, required this.run, required this.businessName, required this.load});
  final StocktakeRun run;
  final String businessName;
  final PhotoBytesLoader load;

  @override
  State<RunProgress> createState() => _RunProgressState();
}

class _RunProgressState extends State<RunProgress> {
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

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final run = widget.run;
    final started = run.startedAt;
    final elapsed = started == null ? null : DateTime.now().difference(started).inSeconds;
    final latest = run.steps.lastOrNull;
    final headline = latest == null ? 'First pass: reading the shelf…' : '${describeStep(latest).$1}…';
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        if (run.photoUrl != null)
          RemotePhoto(
            key: ValueKey(run.photoUrl),
            url: run.photoUrl,
            load: widget.load,
            builder: (_, photo) => photo.image != null
                ? Padding(
                    padding: const EdgeInsets.only(bottom: 20),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(V15.sheetRadius),
                      child: Opacity(opacity: 0.7, child: ScanPhotoView(image: photo.image!)),
                    ),
                  )
                : photo.loading
                ? const Padding(padding: EdgeInsets.only(bottom: 20), child: PhotoSkeleton())
                : const SizedBox.shrink(),
          ),
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
          'Stock-take agent for ${widget.businessName}${elapsed == null ? '' : ' · ${elapsed}s'}',
          style: V15.text(13, FontWeight.w400, c.gray500, tabular: true),
        ),
        const SizedBox(height: 16),
        if (run.steps.isEmpty)
          Text(
            'Reading every product, counting units and matching the catalogue (about 20–30 s).',
            style: V15.description.copyWith(color: c.gray500),
          )
        else
          _Trace(steps: run.steps),
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
                Expanded(child: _Step(step: step)),
              ],
            ),
          ),
      ],
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.step});
  final AgentStep step;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    final (title, detail) = describeStep(step);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
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
      ),
    );
  }
}
