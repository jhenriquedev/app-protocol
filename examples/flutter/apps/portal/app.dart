import 'package:flutter/material.dart';

import '../../core/shared/app_base_context.dart';
import '../../core/ui.case.dart';
import 'registry.dart';
import 'root.dart';

class _PortalLogger implements AppLogger {
  const _PortalLogger();

  void _log(String level, String message, [Map<String, dynamic>? meta]) {
    debugPrint('[portal][$level] $message${meta == null ? '' : ' $meta'}');
  }

  @override
  void debug(String message, [Map<String, dynamic>? meta]) =>
      _log('debug', message, meta);

  @override
  void info(String message, [Map<String, dynamic>? meta]) =>
      _log('info', message, meta);

  @override
  void warn(String message, [Map<String, dynamic>? meta]) =>
      _log('warn', message, meta);

  @override
  void error(String message, [Map<String, dynamic>? meta]) =>
      _log('error', message, meta);
}

const _defaultConfig = PortalConfig(apiBaseUrl: 'http://localhost:3000');

int _portalIdCounter = 0;

String _generateId() {
  _portalIdCounter += 1;
  return 'portal_${DateTime.now().microsecondsSinceEpoch}_$_portalIdCounter';
}

class PortalApp {
  PortalApp({
    required this.registry,
    required this.createUiContext,
    required this.buildApp,
  });

  final PortalRegistry registry;
  final UiContext Function([Map<String, dynamic>? extra]) createUiContext;
  final Widget Function() buildApp;
}

PortalApp bootstrap([PortalConfig config = _defaultConfig]) {
  const logger = _PortalLogger();
  final registry = createRegistry(config);

  UiContext createUiContext([Map<String, dynamic>? extra]) {
    return UiContext(
      correlationId: _generateId(),
      executionId: _generateId(),
      logger: logger,
      api: registry.providers['httpClient'] as dynamic,
      packages: registry.packages,
      renderer: const <String, dynamic>{'runtime': 'flutter'},
      extra: <String, dynamic>{'apiBaseUrl': config.apiBaseUrl, ...?extra},
    );
  }

  Widget buildApp() {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'APP Flutter Task Board',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1F2430),
          brightness: Brightness.light,
        ),
        fontFamilyFallback: const <String>[
          'IBM Plex Sans',
          'Avenir Next',
          'Segoe UI',
          'sans-serif',
        ],
        scaffoldBackgroundColor: Colors.transparent,
      ),
      home: PortalRoot(registry: registry, createUiContext: createUiContext),
    );
  }

  return PortalApp(
    registry: registry,
    createUiContext: createUiContext,
    buildApp: buildApp,
  );
}

final PortalApp app = bootstrap();
