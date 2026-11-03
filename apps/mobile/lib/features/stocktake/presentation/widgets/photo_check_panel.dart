import 'package:flutter/material.dart';

import '../../../../core/design/rich/v15_pulse_skeleton.dart';
import '../../../../core/design/v15_widgets.dart';
import '../../domain/entities/photo_check.dart';
import '../../domain/photo_quality.dart';
import '../cubit/photo_check_cubit.dart';

const _verdictTones = {
  PhotoVerdict.good: V15PillTone.green,
  PhotoVerdict.usable: V15PillTone.amber,
  PhotoVerdict.retake: V15PillTone.red,
};

/// The photo check under the picked photo (apps/mp's photo-check.tsx): advice only, the merchant can always
/// scan anyway. Nothing when the check failed and the phone found nothing either.
class PhotoCheckPanel extends StatelessWidget {
  const PhotoCheckPanel({super.key, required this.state, required this.onRetake});
  final PhotoCheckState state;
  final VoidCallback onRetake;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    if (state.checking) {
      return Semantics(
        liveRegion: true,
        child: Row(
          children: [
            V15Pulse(recolor: false, child: Icon(IconsOutline.stars, size: 16, color: c.primary)),
            const SizedBox(width: 8),
            Expanded(
              child: Text('Checking the photo with Muse Spark…', style: V15.text(14, FontWeight.w400, c.gray500)),
            ),
          ],
        ),
      );
    }
    final r = state.result;
    if (r == null) {
      final warning = localOnlyWarning(state.local);
      if (warning == null) return const SizedBox.shrink();
      return Semantics(
        liveRegion: true,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Icon(IconsOutline.danger_circle, size: 16, color: c.amberFg),
            ),
            const SizedBox(width: 8),
            Expanded(child: Text(warning, style: V15.text(14, FontWeight.w400, c.amberFg))),
          ],
        ),
      );
    }
    final issues = photoIssues(r, state.local);
    return Semantics(
      liveRegion: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              V15Pill(kPhotoVerdictLabels[r.verdict]!, tone: _verdictTones[r.verdict]!),
              if (issues.isNotEmpty) Text(issues.join(' · '), style: V15.text(13, FontWeight.w400, c.gray500)),
              Text(legibilityLine(r), style: V15.text(12, FontWeight.w400, c.gray400, tabular: true)),
            ],
          ),
          if (r.verdict != PhotoVerdict.good && r.instruction.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(r.instruction, style: V15.text(14, FontWeight.w400, c.gray700)),
          ],
          if (r.verdict == PhotoVerdict.retake) ...[
            const SizedBox(height: 8),
            V15Button('Retake photo', icon: IconsOutline.refresh, tone: V15Tone.soft, onPressed: onRetake),
          ],
        ],
      ),
    );
  }
}
