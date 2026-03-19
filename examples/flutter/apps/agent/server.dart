import 'dart:io';

import 'app.dart';
import 'registry.dart';

Future<void> main() async {
  final resolvedPort =
      int.tryParse(
        Platform.environment['PORT'] ??
            Platform.environment['AGENT_PORT'] ??
            '',
      ) ??
      3001;
  final dataDirectory = Platform.environment['APP_FLUTTER_DATA_DIR'];

  await bootstrap(
    AgentConfig(port: resolvedPort, dataDirectory: dataDirectory),
  ).startAgent();
}
