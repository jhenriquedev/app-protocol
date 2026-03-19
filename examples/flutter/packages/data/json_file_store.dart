import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

abstract interface class JsonFileStore<T> {
  String get filePath;

  Future<T> read();

  Future<void> write(T value);

  Future<void> reset();

  Future<T> update(FutureOr<T> Function(T current) updater);
}

class JsonFileStoreOptions<T> {
  const JsonFileStoreOptions({
    required this.filePath,
    required this.fallbackData,
    this.decoder,
    this.encoder,
  });

  final String filePath;
  final T fallbackData;
  final T Function(dynamic json)? decoder;
  final dynamic Function(T value)? encoder;
}

class _JsonFileStore<T> implements JsonFileStore<T> {
  _JsonFileStore(this._options);

  final JsonFileStoreOptions<T> _options;
  Future<void> _operationQueue = Future<void>.value();

  @override
  String get filePath => _options.filePath;

  Future<R> _serialize<R>(Future<R> Function() operation) {
    final completer = Completer<R>();

    _operationQueue = _operationQueue.then(
      (_) async {
        try {
          completer.complete(await operation());
        } catch (error, stackTrace) {
          completer.completeError(error, stackTrace);
        }
      },
      onError: (_) async {
        try {
          completer.complete(await operation());
        } catch (error, stackTrace) {
          completer.completeError(error, stackTrace);
        }
      },
    );

    return completer.future;
  }

  Future<R> _withFileLock<R>(Future<R> Function() operation) async {
    final lockFile = File('${_options.filePath}.lock');
    const timeout = Duration(seconds: 5);
    const retryDelay = Duration(milliseconds: 25);
    const staleLockAge = Duration(seconds: 30);
    final startedAt = DateTime.now();

    while (true) {
      await lockFile.parent.create(recursive: true);

      try {
        await lockFile.create(exclusive: true);
      } on PathExistsException {
        await _cleanupStaleLock(lockFile, staleLockAge);

        if (DateTime.now().difference(startedAt) >= timeout) {
          throw Exception(
            'Timed out acquiring JsonFileStore lock for ${_options.filePath}',
          );
        }

        await Future<void>.delayed(retryDelay);
        continue;
      }

      try {
        await lockFile.writeAsString(
          '${jsonEncode(<String, dynamic>{'pid': pid, 'acquiredAt': DateTime.now().toUtc().toIso8601String()})}\n',
          flush: true,
        );
      } catch (error) {
        if (await lockFile.exists()) {
          await lockFile.delete();
        }
        rethrow;
      }

      try {
        return await operation();
      } finally {
        if (await lockFile.exists()) {
          await lockFile.delete();
        }
      }
    }
  }

  Future<void> _cleanupStaleLock(File lockFile, Duration maxAge) async {
    try {
      final stat = await lockFile.stat();
      if (DateTime.now().difference(stat.modified) > maxAge &&
          await lockFile.exists()) {
        await lockFile.delete();
      }
    } on FileSystemException {
      return;
    }
  }

  Future<void> _ensureFileExists() async {
    final file = File(_options.filePath);
    await file.parent.create(recursive: true);

    if (!await file.exists()) {
      await _writeJsonAtomically(_options.fallbackData);
    }
  }

  Future<void> _writeJsonAtomically(T value) async {
    final random = Random.secure().nextInt(1 << 32);
    final tempPath =
        '$_options.filePath.$pid.${DateTime.now().microsecondsSinceEpoch}.$random.tmp';
    final tempFile = File(tempPath);
    final encoded = _options.encoder != null ? _options.encoder!(value) : value;
    final content = '${jsonEncode(encoded)}\n';

    await tempFile.parent.create(recursive: true);
    await tempFile.writeAsString(content, flush: true);
    await tempFile.rename(_options.filePath);
  }

  Future<T> _readJsonFile() async {
    final file = File(_options.filePath);
    final content = await file.readAsString();
    final decoded = jsonDecode(content);
    return _options.decoder != null ? _options.decoder!(decoded) : decoded as T;
  }

  @override
  Future<T> read() {
    return _serialize(() async {
      return _withFileLock(() async {
        await _ensureFileExists();
        return _readJsonFile();
      });
    });
  }

  @override
  Future<void> write(T value) {
    return _serialize(() async {
      return _withFileLock(() async {
        await _ensureFileExists();
        await _writeJsonAtomically(value);
      });
    });
  }

  @override
  Future<void> reset() {
    return _serialize(() async {
      return _withFileLock(() async {
        await _ensureFileExists();
        await _writeJsonAtomically(_options.fallbackData);
      });
    });
  }

  @override
  Future<T> update(FutureOr<T> Function(T current) updater) {
    return _serialize(() async {
      return _withFileLock(() async {
        await _ensureFileExists();
        final current = await _readJsonFile();
        final next = await updater(current);

        if (!identical(next, current)) {
          await _writeJsonAtomically(next);
        }

        return next;
      });
    });
  }
}

JsonFileStore<T> createJsonFileStore<T>(JsonFileStoreOptions<T> options) {
  return _JsonFileStore<T>(options);
}
