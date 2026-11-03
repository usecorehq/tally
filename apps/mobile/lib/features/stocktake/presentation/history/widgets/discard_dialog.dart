import 'package:flutter/material.dart';

import '../../../../../core/design/v15_widgets.dart';

/// Asks before discarding an open stock-take. [discard] returns null on success, else the reason,
/// which stays in the dialog (as mp's ConfirmDialog). True once discarded.
Future<bool> confirmDiscard(BuildContext context, Future<String?> Function() discard) async {
  final done = await showDialog<bool>(
    context: context,
    builder: (_) => _DiscardDialog(discard: discard),
  );
  return done ?? false;
}

class _DiscardDialog extends StatefulWidget {
  const _DiscardDialog({required this.discard});
  final Future<String?> Function() discard;

  @override
  State<_DiscardDialog> createState() => _DiscardDialogState();
}

class _DiscardDialogState extends State<_DiscardDialog> {
  bool _busy = false;
  String? _error;

  Future<void> _confirm() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final error = await widget.discard();
    if (!mounted) return;
    if (error == null) return Navigator.of(context).pop(true);
    setState(() {
      _busy = false;
      _error = error;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return AlertDialog(
      backgroundColor: c.surface,
      title: Text('Discard this stock-take?', style: V15.dialogTitle.copyWith(color: c.gray900)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Nothing changes in your stock. It stays in your history, read-only, and you can't confirm it later.",
            style: V15.description.copyWith(color: c.gray600),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: V15.description.copyWith(color: c.redFg)),
          ],
        ],
      ),
      actions: [
        V15Button(
          'Cancel',
          tone: V15Tone.quiet,
          height: 40,
          onPressed: _busy ? null : () => Navigator.of(context).pop(false),
        ),
        _DestructiveButton(busy: _busy, onPressed: _confirm),
      ],
    );
  }
}

/// The kit has no destructive key: red fill, white label, the same 12px corners.
class _DestructiveButton extends StatelessWidget {
  const _DestructiveButton({required this.busy, required this.onPressed});
  final bool busy;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final c = V15.of(context);
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: busy ? null : onPressed,
        child: Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: c.dangerFg, borderRadius: BorderRadius.circular(kV15ButtonRadius)),
          child: busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : Text('Discard', style: V15.ui.copyWith(color: Colors.white)),
        ),
      ),
    );
  }
}
