import 'dart:io';

import 'package:path/path.dart' as path;

import 'json_file_store.dart';
import 'task_store.dart';

typedef JsonFileStoreFactory =
    JsonFileStore<T> Function<T>(JsonFileStoreOptions<T> options);

class DataPackage {
  const DataPackage({
    required this.defaultFiles,
    required this.createJsonFileStore,
    required this.taskStore,
  });

  final Map<String, String> defaultFiles;
  final JsonFileStoreFactory createJsonFileStore;
  final TaskStore taskStore;
}

DataPackage createDataPackage([String? baseDirectory]) {
  final resolvedBaseDirectory =
      baseDirectory ?? path.join(Directory.current.path, 'packages', 'data');
  final defaultFiles = <String, String>{
    'tasks': path.join(resolvedBaseDirectory, 'tasks.json'),
  };

  return DataPackage(
    defaultFiles: defaultFiles,
    createJsonFileStore: createJsonFileStore,
    taskStore: createTaskStore(defaultFiles['tasks']!),
  );
}

TaskStore createTaskStore(String filePath) {
  return JsonTaskStore(
    createJsonFileStore<List<Map<String, dynamic>>>(
      JsonFileStoreOptions<List<Map<String, dynamic>>>(
        filePath: filePath,
        fallbackData: const <Map<String, dynamic>>[],
        decoder: (dynamic json) {
          if (json is! List) {
            return <Map<String, dynamic>>[];
          }

          return json
              .whereType<Map>()
              .map((Map item) => Map<String, dynamic>.from(item))
              .toList(growable: false);
        },
        encoder: (List<Map<String, dynamic>> value) {
          return value;
        },
      ),
    ),
  );
}
