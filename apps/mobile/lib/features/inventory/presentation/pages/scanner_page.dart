import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../core/utils/naira.dart';
import '../../../../injection_container.dart';
import '../../domain/entities/inventory_item.dart';
import '../cubit/scan_cubit.dart';
import '../widgets/link_item_sheet.dart';

class ScannerPage extends StatelessWidget {
  const ScannerPage({super.key, required this.businessId, required this.businessName});
  final String businessId;
  final String businessName;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ScanCubit>(param1: businessId)..prepare(),
      child: _ScannerView(businessName: businessName),
    );
  }
}

class _ScannerView extends StatefulWidget {
  const _ScannerView({required this.businessName});
  final String businessName;

  @override
  State<_ScannerView> createState() => _ScannerViewState();
}

class _ScannerViewState extends State<_ScannerView> with WidgetsBindingObserver {
  // Product barcodes only (same formats as qore-inventory, minus QR/DataMatrix).
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    formats: const [
      BarcodeFormat.ean13,
      BarcodeFormat.ean8,
      BarcodeFormat.upcA,
      BarcodeFormat.upcE,
      BarcodeFormat.code128,
      BarcodeFormat.code39,
    ],
  );
  bool _paused = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Platform camera calls can throw before the controller is ready (iOS first launch).
    try {
      if (state == AppLifecycleState.resumed && !_paused) {
        unawaited(_controller.start());
      } else if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused) {
        unawaited(_controller.stop());
      }
    } catch (_) {}
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_paused) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw == null || raw.isEmpty) return;
    setState(() => _paused = true);
    unawaited(_controller.stop());
    unawaited(HapticFeedback.mediumImpact());
    await context.read<ScanCubit>().scanned(raw);
  }

  Future<void> _resume() async {
    context.read<ScanCubit>().resume();
    setState(() => _paused = false);
    try {
      await _controller.start();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(widget.businessName),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Torch',
            icon: const Icon(Icons.flashlight_on_outlined),
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(
        children: [
          Positioned.fill(
            child: MobileScanner(controller: _controller, onDetect: _onDetect),
          ),
          const Positioned.fill(child: IgnorePointer(child: _Viewfinder())),
          Align(
            alignment: Alignment.bottomCenter,
            child: BlocBuilder<ScanCubit, ScanState>(
              builder: (context, state) => _ResultPanel(state: state, onResume: _resume),
            ),
          ),
        ],
      ),
    );
  }
}

class _Viewfinder extends StatelessWidget {
  const _Viewfinder();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 280,
        height: 160,
        decoration: BoxDecoration(
          border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 2),
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }
}

class _ResultPanel extends StatelessWidget {
  const _ResultPanel({required this.state, required this.onResume});
  final ScanState state;
  final Future<void> Function() onResume;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<ScanCubit>();
    final child = switch (state) {
      ScanPreparing() => const _Status(spinner: true, text: 'Loading your inventory…'),
      ScanCacheError() => const _Status(text: 'Offline lookup unavailable — scans will check online.'),
      ScanIdle() => const _Status(text: 'Point the camera at a barcode'),
      ScanLookingUp(:final barcode) => _Status(spinner: true, text: 'Looking up $barcode…'),
      ScanFound(:final item, :final fromCache) => _ItemCard(item: item, fromCache: fromCache, onNext: onResume),
      ScanLinked(:final item) => _ItemCard(item: item, linked: true, onNext: onResume),
      ScanLinking(:final barcode) => _Status(spinner: true, text: 'Linking $barcode…'),
      ScanNotFound(:final barcode, :final linkable) => _Card(
        title: 'New barcode',
        subtitle: barcode,
        body: linkable.isEmpty
            ? 'Every item already has a barcode. Add the product on the web first.'
            : "This barcode isn't linked to any of your items yet. Link it once and every scan after is instant.",
        primary: linkable.isEmpty
            ? null
            : FilledButton(
                onPressed: () async {
                  final item = await showLinkItemSheet(context, items: linkable, barcode: barcode);
                  if (item != null) await cubit.link(barcode, item);
                },
                child: const Text('Link to an item'),
              ),
        onNext: onResume,
      ),
      ScanError(:final message) => _Card(title: "Couldn't complete that", body: message, onNext: onResume),
    };
    return SafeArea(
      top: false,
      child: Padding(padding: const EdgeInsets.all(16), child: child),
    );
  }
}

class _Status extends StatelessWidget {
  const _Status({required this.text, this.spinner = false});
  final String text;
  final bool spinner;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (spinner) ...[
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            ),
            const SizedBox(width: 12),
          ],
          Flexible(
            child: Text(text, style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}

class _ItemCard extends StatelessWidget {
  const _ItemCard({required this.item, required this.onNext, this.fromCache = false, this.linked = false});
  final InventoryItem item;
  final bool fromCache;
  final bool linked;
  final Future<void> Function() onNext;

  @override
  Widget build(BuildContext context) {
    return _Card(
      title: item.name,
      subtitle: linked ? 'Barcode linked' : (fromCache ? 'Found on this device' : 'Found'),
      stats: [('Price', formatNaira(item.price)), ('In stock', formatQuantity(item.quantityOnHand))],
      onNext: onNext,
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.onNext, this.subtitle, this.body, this.stats, this.primary});
  final String title;
  final String? subtitle;
  final String? body;
  final List<(String, String)>? stats;
  final Widget? primary;
  final Future<void> Function() onNext;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(24),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            if (subtitle != null) ...[
              const SizedBox(height: 4),
              Text(subtitle!, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            ],
            if (body != null) ...[const SizedBox(height: 12), Text(body!, style: theme.textTheme.bodyMedium)],
            if (stats != null) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  for (final (label, value) in stats!)
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            label,
                            style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                          ),
                          Text(value, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 20),
            if (primary != null) ...[primary!, const SizedBox(height: 8)],
            OutlinedButton(onPressed: onNext, child: const Text('Scan next')),
          ],
        ),
      ),
    );
  }
}
