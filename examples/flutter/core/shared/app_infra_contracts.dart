abstract interface class AppHttpClient {
  Future<dynamic> request(dynamic config);
}

abstract interface class AppStorageClient {
  Future<dynamic> get(String key);

  Future<void> set(String key, dynamic value);
}

abstract interface class AppCache {
  Future<dynamic> get(String key);

  Future<void> set(String key, dynamic value, [int? ttl]);
}

abstract interface class AppEventPublisher {
  Future<void> publish(String event, dynamic payload);
}
