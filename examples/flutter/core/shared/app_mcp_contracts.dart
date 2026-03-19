import '../domain.case.dart';

class AppMcpClientInfo {
  const AppMcpClientInfo({required this.name, required this.version});

  final String name;
  final String version;

  Dict toJson() {
    return {'name': name, 'version': version};
  }
}

class AppMcpServerInfo {
  const AppMcpServerInfo({
    required this.name,
    required this.version,
    required this.protocolVersion,
    this.instructions,
  });

  final String name;
  final String version;
  final String protocolVersion;
  final String? instructions;
}

class AppMcpInitializeParams {
  const AppMcpInitializeParams({
    required this.protocolVersion,
    this.capabilities,
    this.clientInfo,
  });

  final String protocolVersion;
  final Dict? capabilities;
  final AppMcpClientInfo? clientInfo;
}

class AppMcpInitializeResult {
  const AppMcpInitializeResult({
    required this.protocolVersion,
    required this.capabilities,
    required this.serverInfo,
    this.instructions,
  });

  final String protocolVersion;
  final Dict capabilities;
  final Dict serverInfo;
  final String? instructions;

  Dict toJson() {
    return {
      'protocolVersion': protocolVersion,
      'capabilities': capabilities,
      'serverInfo': serverInfo,
      if (instructions != null) 'instructions': instructions,
    };
  }
}

class AppMcpTextContent {
  const AppMcpTextContent({required this.text}) : type = 'text';

  final String type;
  final String text;

  Dict toJson() {
    return {'type': type, 'text': text};
  }
}

class AppMcpToolDescriptor {
  const AppMcpToolDescriptor({
    required this.name,
    required this.inputSchema,
    this.title,
    this.description,
    this.outputSchema,
    this.annotations,
  });

  final String name;
  final String? title;
  final String? description;
  final AppSchema inputSchema;
  final AppSchema? outputSchema;
  final Dict? annotations;

  Dict toJson() {
    return {
      'name': name,
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      'inputSchema': inputSchema,
      if (outputSchema != null) 'outputSchema': outputSchema,
      if (annotations != null) 'annotations': annotations,
    };
  }
}

class AppMcpResourceDescriptor {
  const AppMcpResourceDescriptor({
    required this.uri,
    required this.name,
    this.title,
    this.description,
    this.mimeType,
    this.annotations,
  });

  final String uri;
  final String name;
  final String? title;
  final String? description;
  final String? mimeType;
  final Dict? annotations;

  Dict toJson() {
    return {
      'uri': uri,
      'name': name,
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      if (mimeType != null) 'mimeType': mimeType,
      if (annotations != null) 'annotations': annotations,
    };
  }
}

class AppMcpTextResourceContent {
  const AppMcpTextResourceContent({
    required this.uri,
    required this.text,
    this.mimeType,
  });

  final String uri;
  final String? mimeType;
  final String text;

  Dict toJson() {
    return {
      'uri': uri,
      if (mimeType != null) 'mimeType': mimeType,
      'text': text,
    };
  }
}

class AppMcpCallResult {
  const AppMcpCallResult({
    required this.content,
    this.structuredContent,
    this.isError,
  });

  final List<AppMcpTextContent> content;
  final dynamic structuredContent;
  final bool? isError;

  Dict toJson() {
    return {
      'content': content.map((item) => item.toJson()).toList(growable: false),
      if (structuredContent != null) 'structuredContent': structuredContent,
      if (isError != null) 'isError': isError,
    };
  }
}

class AppMcpReadResourceResult {
  const AppMcpReadResourceResult({required this.contents});

  final List<AppMcpTextResourceContent> contents;

  Dict toJson() {
    return {
      'contents': contents.map((item) => item.toJson()).toList(growable: false),
    };
  }
}

class AppMcpRequestContext {
  const AppMcpRequestContext({
    required this.transport,
    this.requestId,
    this.sessionId,
    this.correlationId,
    this.clientInfo,
    this.protocolVersion,
  });

  final String transport;
  final dynamic requestId;
  final String? sessionId;
  final String? correlationId;
  final AppMcpClientInfo? clientInfo;
  final String? protocolVersion;
}

abstract interface class AppMcpServer {
  AppMcpServerInfo serverInfo();

  Future<AppMcpInitializeResult> initialize([
    AppMcpInitializeParams? params,
    AppMcpRequestContext? parent,
  ]);

  Future<List<AppMcpToolDescriptor>> listTools([AppMcpRequestContext? parent]);

  Future<List<AppMcpResourceDescriptor>> listResources([
    AppMcpRequestContext? parent,
  ]);

  Future<AppMcpReadResourceResult> readResource(
    String uri, [
    AppMcpRequestContext? parent,
  ]);

  Future<AppMcpCallResult> callTool(
    String name,
    dynamic args, [
    AppMcpRequestContext? parent,
  ]);
}

abstract class BaseAppMcpAdapter {
  String get transport;
}

abstract class BaseAppMcpProcessAdapter extends BaseAppMcpAdapter {
  Future<void> serve(AppMcpServer server);
}

class AppMcpHttpExchange {
  const AppMcpHttpExchange({
    required this.method,
    required this.path,
    required this.headers,
    this.bodyText,
  });

  final String method;
  final String path;
  final Map<String, String?> headers;
  final String? bodyText;
}

class AppMcpHttpResponse {
  const AppMcpHttpResponse({
    required this.statusCode,
    this.headers,
    this.bodyText,
  });

  final int statusCode;
  final Map<String, String>? headers;
  final String? bodyText;
}

abstract class BaseAppMcpHttpAdapter extends BaseAppMcpAdapter {
  String get endpointPath;

  Future<AppMcpHttpResponse?> handle(
    AppMcpHttpExchange exchange,
    AppMcpServer server,
  );
}

class AppMcpProtocolError implements Exception {
  const AppMcpProtocolError(this.code, this.message, [this.data]);

  final int code;
  final String message;
  final dynamic data;

  @override
  String toString() {
    return 'AppMcpProtocolError($code): $message';
  }
}
