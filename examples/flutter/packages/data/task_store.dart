import 'json_file_store.dart';

abstract interface class TaskStore {
  Future<List<Map<String, dynamic>>> read();

  Future<void> write(List<Map<String, dynamic>> value);

  Future<void> reset();

  Future<List<Map<String, dynamic>>> update(
    Future<List<Map<String, dynamic>>> Function(
      List<Map<String, dynamic>> current,
    )
    updater,
  );
}

class JsonTaskStore implements TaskStore {
  JsonTaskStore(this._store);

  final JsonFileStore<List<Map<String, dynamic>>> _store;

  @override
  Future<List<Map<String, dynamic>>> read() {
    return _store.read();
  }

  @override
  Future<void> write(List<Map<String, dynamic>> value) {
    return _store.write(value);
  }

  @override
  Future<void> reset() {
    return _store.reset();
  }

  @override
  Future<List<Map<String, dynamic>>> update(
    Future<List<Map<String, dynamic>>> Function(
      List<Map<String, dynamic>> current,
    )
    updater,
  ) {
    return _store.update(updater);
  }
}
