import 'dart:io';

import 'app.dart';
import 'registry.dart';

Future<void> main() async {
  final resolvedPort =
      int.tryParse(
        Platform.environment['PORT'] ?? Platform.environment['API_PORT'] ?? '',
      ) ??
      3000;
  final dataDirectory = Platform.environment['APP_FLUTTER_DATA_DIR'];

  await bootstrap(
    BackendConfig(port: resolvedPort, dataDirectory: dataDirectory),
  ).startBackend();
}
