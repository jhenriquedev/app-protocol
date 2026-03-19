import 'dart:io';

import 'app.dart';
import 'registry.dart';

Future<void> main() async {
  final dataDirectory = Platform.environment['APP_FLUTTER_DATA_DIR'];

  await bootstrap(AgentConfig(dataDirectory: dataDirectory)).publishMcp();
}
