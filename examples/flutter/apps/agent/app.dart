import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../core/agentic.case.dart';
import '../../core/api.case.dart';
import '../../core/shared/app_base_context.dart';
import '../../core/shared/app_host_contracts.dart';
import '../../core/shared/app_mcp_contracts.dart';
import '../../core/shared/app_structural_contracts.dart';
import 'registry.dart';

const String appVersion = '1.1.0';
const String mcpProtocolVersion = '2025-11-25';
const List<String> mcpSupportedProtocolVersions = <String>[
  mcpProtocolVersion,
  '2025-06-18',
];

class _AgentLogger implements AppLogger {
  const _AgentLogger();

  void _log(String level, String message, [Map<String, dynamic>? meta]) {
    stderr.writeln('[agent][$level] $message${meta == null ? '' : ' $meta'}');
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

class AgentApp {
  AgentApp({
    required this.registry,
    required this.createApiContext,
    required this.createAgenticContext,
    required this.buildAgentCatalog,
    required this.resolveTool,
    required this.executeTool,
    required this.validateAgenticRuntime,
    required this.buildSystemPrompt,
    required this.mcpServerInfo,
    required this.initializeMcp,
    required this.listMcpTools,
    required this.listMcpResources,
    required this.readMcpResource,
    required this.callMcpTool,
    required this.publishMcp,
    required this.handleRequest,
    required this.startAgent,
  });

  final AppAgentRegistry registry;
  final ApiContext Function([Map<String, dynamic>? parent]) createApiContext;
  final AgenticContext Function([Map<String, dynamic>? parent])
  createAgenticContext;
  final List<AgenticCatalogEntry<dynamic, dynamic>> Function([
    Map<String, dynamic>? parent,
  ])
  buildAgentCatalog;
  final AgenticCatalogEntry<dynamic, dynamic>? Function(
    String toolName, [
    Map<String, dynamic>? parent,
  ])
  resolveTool;
  final Future<dynamic> Function(
    String toolName,
    dynamic input, [
    Map<String, dynamic>? parent,
  ])
  executeTool;
  final Future<Map<String, int>> Function() validateAgenticRuntime;
  final String Function([Map<String, dynamic>? parent]) buildSystemPrompt;
  final AppMcpServerInfo Function() mcpServerInfo;
  final Future<AppMcpInitializeResult> Function([
    AppMcpInitializeParams? params,
    AppMcpRequestContext? parent,
  ])
  initializeMcp;
  final Future<List<AppMcpToolDescriptor>> Function([
    AppMcpRequestContext? parent,
  ])
  listMcpTools;
  final Future<List<AppMcpResourceDescriptor>> Function([
    AppMcpRequestContext? parent,
  ])
  listMcpResources;
  final Future<AppMcpReadResourceResult> Function(
    String uri, [
    AppMcpRequestContext? parent,
  ])
  readMcpResource;
  final Future<AppMcpCallResult> Function(
    String name,
    dynamic args, [
    AppMcpRequestContext? parent,
  ])
  callMcpTool;
  final Future<void> Function() publishMcp;
  final Future<void> Function(HttpRequest request) handleRequest;
  final Future<HttpServer> Function() startAgent;
}

class _RuntimeMcpServer implements AppMcpServer {
  _RuntimeMcpServer({
    required this.onServerInfo,
    required this.onInitialize,
    required this.onListTools,
    required this.onListResources,
    required this.onReadResource,
    required this.onCallTool,
  });

  final AppMcpServerInfo Function() onServerInfo;
  final Future<AppMcpInitializeResult> Function([
    AppMcpInitializeParams? params,
    AppMcpRequestContext? parent,
  ])
  onInitialize;
  final Future<List<AppMcpToolDescriptor>> Function([
    AppMcpRequestContext? parent,
  ])
  onListTools;
  final Future<List<AppMcpResourceDescriptor>> Function([
    AppMcpRequestContext? parent,
  ])
  onListResources;
  final Future<AppMcpReadResourceResult> Function(
    String uri, [
    AppMcpRequestContext? parent,
  ])
  onReadResource;
  final Future<AppMcpCallResult> Function(
    String name,
    dynamic args, [
    AppMcpRequestContext? parent,
  ])
  onCallTool;

  @override
  AppMcpServerInfo serverInfo() => onServerInfo();

  @override
  Future<AppMcpInitializeResult> initialize([
    AppMcpInitializeParams? params,
    AppMcpRequestContext? parent,
  ]) {
    return onInitialize(params, parent);
  }

  @override
  Future<List<AppMcpToolDescriptor>> listTools([AppMcpRequestContext? parent]) {
    return onListTools(parent);
  }

  @override
  Future<List<AppMcpResourceDescriptor>> listResources([
    AppMcpRequestContext? parent,
  ]) {
    return onListResources(parent);
  }

  @override
  Future<AppMcpReadResourceResult> readResource(
    String uri, [
    AppMcpRequestContext? parent,
  ]) {
    return onReadResource(uri, parent);
  }

  @override
  Future<AppMcpCallResult> callTool(
    String name,
    dynamic args, [
    AppMcpRequestContext? parent,
  ]) {
    return onCallTool(name, args, parent);
  }
}

int _agentIdCounter = 0;

String _generateId() {
  _agentIdCounter += 1;
  return 'agent_${DateTime.now().microsecondsSinceEpoch}_$_agentIdCounter';
}

int _mapErrorCodeToStatus(String? code) {
  switch (code) {
    case 'INVALID_REQUEST':
    case 'VALIDATION_FAILED':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'CONFIRMATION_REQUIRED':
    case 'EXECUTION_MODE_RESTRICTED':
      return 409;
    default:
      return 500;
  }
}

dynamic _toSerializable(dynamic value) {
  if (value == null || value is String || value is num || value is bool) {
    return value;
  }

  if (value is Map) {
    return value.map(
      (dynamic key, dynamic item) =>
          MapEntry(key.toString(), _toSerializable(item)),
    );
  }

  if (value is Iterable) {
    return value.map(_toSerializable).toList(growable: false);
  }

  if (value is AppResult) {
    return value.toJson(_toSerializable);
  }

  try {
    return _toSerializable((value as dynamic).toJson());
  } catch (_) {
    return value.toString();
  }
}

Future<dynamic> _readRequestBody(HttpRequest request) async {
  final content = await utf8.decoder.bind(request).join();
  final normalized = content.trim();
  if (normalized.isEmpty) {
    return null;
  }

  return jsonDecode(normalized);
}

Future<String?> _readRawRequestBody(HttpRequest request) async {
  final content = await utf8.decoder.bind(request).join();
  final normalized = content.trim();
  return normalized.isEmpty ? null : normalized;
}

void _sendJson(HttpResponse response, int statusCode, dynamic body) {
  response.statusCode = statusCode;
  response.headers.contentType = ContentType.json;
  response.headers.set('access-control-allow-origin', '*');
  response.headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
  response.headers.set('access-control-allow-headers', 'content-type');
  response.headers.set('cache-control', 'no-store');
  response.write(
    const JsonEncoder.withIndent('  ').convert(_toSerializable(body)),
  );
  response.close();
}

void _sendStructuredError(
  HttpResponse response,
  int statusCode,
  String code,
  String message, [
  dynamic details,
]) {
  _sendJson(response, statusCode, <String, dynamic>{
    'success': false,
    'error': <String, dynamic>{
      'code': code,
      'message': message,
      if (details != null) 'details': details,
    },
  });
}

void _sendMcpHttpResponse(
  HttpResponse response,
  AppMcpHttpResponse httpResponse,
) {
  response.statusCode = httpResponse.statusCode;
  httpResponse.headers?.forEach(response.headers.set);
  if (httpResponse.bodyText != null) {
    response.write(httpResponse.bodyText);
  }
  response.close();
}

Map<String, String?> _toHeaderMap(HttpHeaders headers) {
  final normalized = <String, String?>{};
  headers.forEach((String name, List<String> values) {
    normalized[name.toLowerCase()] = values.join(', ');
  });
  return normalized;
}

List<String> _normalizeTextItems(List<String>? values) {
  if (values == null) {
    return const <String>[];
  }

  return values
      .map((String value) => value.trim())
      .where((String value) => value.isNotEmpty)
      .toSet()
      .toList(growable: false);
}

String _humanizeIdentifier(String value) {
  return value
      .split(RegExp(r'[_-]+'))
      .where((String part) => part.isNotEmpty)
      .map((String part) => part[0].toUpperCase() + part.substring(1))
      .join(' ');
}

String? _joinSentence(String label, List<String>? values) {
  final normalized = _normalizeTextItems(values);
  if (normalized.isEmpty) {
    return null;
  }

  return '$label: ${normalized.join('; ')}.';
}

String _buildSystemPromptResourceUri() => 'app://agent/system/prompt';

String _buildToolSemanticResourceUri(
  AgenticCatalogEntry<dynamic, dynamic> entry,
) {
  return 'app://agent/tools/${entry.publishedName}/semantic';
}

Map<String, dynamic> _stripDefinitionForProjection(
  AgenticCatalogEntry<dynamic, dynamic> entry,
) {
  final definition = entry.definition.toJson();
  final tool = Map<String, dynamic>.from(definition['tool'] as Map);

  return <String, dynamic>{
    ...definition,
    'tool': <String, dynamic>{
      'name': tool['name'],
      'description': tool['description'],
      'inputSchema': tool['inputSchema'],
      'outputSchema': tool['outputSchema'],
      'isMutating': tool['isMutating'] ?? false,
      'requiresConfirmation': tool['requiresConfirmation'] ?? false,
    },
  };
}

String _buildToolSemanticSummary(AgenticCatalogEntry<dynamic, dynamic> entry) {
  final definition = entry.definition;
  final parts = <String?>[
    definition.prompt.purpose.trim(),
    _joinSentence('Use when', <String>[
      ...?definition.prompt.whenToUse,
      ...?definition.discovery.intents,
    ]),
    _joinSentence('Do not use when', definition.prompt.whenNotToUse),
    _joinSentence('Preconditions', definition.context.preconditions),
    _joinSentence('Constraints', <String>[
      ...?definition.context.constraints,
      ...?definition.prompt.constraints,
      ...?definition.policy?.limits,
    ]),
    definition.prompt.expectedOutcome == null
        ? null
        : 'Expected outcome: ${definition.prompt.expectedOutcome!.trim()}.',
  ];

  return parts
      .whereType<String>()
      .where((String value) => value.trim().isNotEmpty)
      .join(' ');
}

String _buildToolPromptFragment(AgenticCatalogEntry<dynamic, dynamic> entry) {
  final definition = entry.definition;
  final lines = <String?>[
    'Tool ${entry.publishedName}: ${definition.prompt.purpose}',
    _joinSentence('Use when', <String>[
      ...?definition.prompt.whenToUse,
      ...?definition.discovery.intents,
    ]),
    _joinSentence('Do not use when', definition.prompt.whenNotToUse),
    _joinSentence('Aliases', definition.discovery.aliases),
    _joinSentence('Capabilities', definition.discovery.capabilities),
    _joinSentence('Dependencies', definition.context.dependencies),
    _joinSentence('Preconditions', definition.context.preconditions),
    _joinSentence('Constraints', <String>[
      ...?definition.context.constraints,
      ...?definition.prompt.constraints,
      ...?definition.policy?.limits,
    ]),
    _joinSentence('Reasoning hints', definition.prompt.reasoningHints),
    _joinSentence('RAG topics', definition.rag?.topics),
    _joinSentence(
      'RAG resources',
      definition.rag?.resources
          ?.map(
            (RagResource resource) => resource.description == null
                ? '${resource.kind}:${resource.ref}'
                : '${resource.kind}:${resource.ref} (${resource.description})',
          )
          .toList(growable: false),
    ),
    _joinSentence('RAG hints', definition.rag?.hints),
    'Execution mode: ${entry.executionMode}.',
    'Requires confirmation: ${entry.requiresConfirmation ? 'yes' : 'no'}.',
    definition.prompt.expectedOutcome == null
        ? null
        : 'Expected outcome: ${definition.prompt.expectedOutcome}.',
  ];

  return lines
      .whereType<String>()
      .where((String value) => value.trim().isNotEmpty)
      .join('\n');
}

Map<String, dynamic> _toCatalogDocument(
  AgenticCatalogEntry<dynamic, dynamic> entry,
) {
  return <String, dynamic>{
    'ref': entry.ref.toJson(),
    'publishedName': entry.publishedName,
    'isMcpEnabled': entry.isMcpEnabled,
    'requiresConfirmation': entry.requiresConfirmation,
    'executionMode': entry.executionMode,
    'semanticSummary': _buildToolSemanticSummary(entry),
    'promptFragment': _buildToolPromptFragment(entry),
    'resources': <String, dynamic>{
      'semantic': _buildToolSemanticResourceUri(entry),
    },
    'definition': _stripDefinitionForProjection(entry),
  };
}

Map<String, dynamic> _toMcpSemanticAnnotations(
  AgenticCatalogEntry<dynamic, dynamic> entry,
) {
  return <String, dynamic>{
    'readOnlyHint': !(entry.definition.tool.isMutating ?? false),
    'destructiveHint': entry.definition.tool.isMutating ?? false,
    'requiresConfirmation': entry.requiresConfirmation,
    'executionMode': entry.executionMode,
    'appSemantic': <String, dynamic>{
      'summary': _buildToolSemanticSummary(entry),
      'discovery': entry.definition.discovery.toJson(),
      'context': entry.definition.context.toJson(),
      'prompt': entry.definition.prompt.toJson(),
      if (entry.definition.policy != null)
        'policy': entry.definition.policy!.toJson(),
      if (entry.definition.rag != null) 'rag': entry.definition.rag!.toJson(),
      'exampleNames':
          entry.definition.examples
              ?.map((AgenticExample<dynamic, dynamic> example) => example.name)
              .toList(growable: false) ??
          const <String>[],
      'resourceUri': _buildToolSemanticResourceUri(entry),
    },
  };
}

AppMcpToolDescriptor _toMcpToolDescriptor(
  AgenticCatalogEntry<dynamic, dynamic> entry,
) {
  final summary = _buildToolSemanticSummary(entry);

  return AppMcpToolDescriptor(
    name: entry.publishedName,
    title:
        entry.definition.mcp?.title ?? _humanizeIdentifier(entry.publishedName),
    description: entry.definition.mcp?.description == null
        ? summary
        : '${entry.definition.mcp!.description} $summary',
    inputSchema: entry.definition.tool.inputSchema,
    outputSchema: entry.definition.tool.outputSchema,
    annotations: _toMcpSemanticAnnotations(entry),
  );
}

AppMcpResourceDescriptor _toMcpSemanticResourceDescriptor(
  AgenticCatalogEntry<dynamic, dynamic> entry,
) {
  return AppMcpResourceDescriptor(
    uri: _buildToolSemanticResourceUri(entry),
    name: '${entry.publishedName}_semantic',
    title: '${_humanizeIdentifier(entry.publishedName)} Semantic Contract',
    description:
        'Complete APP agentic definition projected automatically from the registry for ${entry.publishedName}.',
    mimeType: 'application/json',
    annotations: <String, dynamic>{
      'toolName': entry.publishedName,
      'executionMode': entry.executionMode,
      'requiresConfirmation': entry.requiresConfirmation,
    },
  );
}

AppMcpResourceDescriptor _toMcpSystemPromptDescriptor() {
  return const AppMcpResourceDescriptor(
    uri: 'app://agent/system/prompt',
    name: 'agent_system_prompt',
    title: 'Agent System Prompt',
    description:
        'Host-level system prompt composed automatically from the registered tool fragments.',
    mimeType: 'text/markdown',
    annotations: <String, dynamic>{'kind': 'system-prompt'},
  );
}

AppMcpCallResult _toMcpSuccessResult(String toolName, dynamic data) {
  return AppMcpCallResult(
    content: <AppMcpTextContent>[
      AppMcpTextContent(text: 'Tool $toolName executed successfully.'),
    ],
    structuredContent: data,
    isError: false,
  );
}

AppMcpCallResult _toMcpErrorResult(AppCaseError error) {
  return AppMcpCallResult(
    content: <AppMcpTextContent>[AppMcpTextContent(text: error.message)],
    structuredContent: <String, dynamic>{
      'success': false,
      'error': error.toAppError().toJson(),
    },
    isError: true,
  );
}

Map<String, dynamic> _toExecutionEnvelope(dynamic body) {
  if (body is! Map) {
    return <String, dynamic>{'input': body, 'confirmed': false};
  }

  final record = Map<String, dynamic>.from(body);
  if (record.containsKey('confirmed')) {
    final confirmed = record['confirmed'] == true;
    if (record.containsKey('input')) {
      return <String, dynamic>{
        'input': record['input'],
        'confirmed': confirmed,
      };
    }

    final clone = Map<String, dynamic>.from(record)..remove('confirmed');
    return <String, dynamic>{'input': clone, 'confirmed': confirmed};
  }

  if (record.containsKey('input')) {
    return <String, dynamic>{'input': record['input'], 'confirmed': false};
  }

  return <String, dynamic>{'input': record, 'confirmed': false};
}

AgentApp bootstrap([AgentConfig config = const AgentConfig()]) {
  const logger = _AgentLogger();
  final registry = createRegistry(config);

  late final ApiContext Function([Map<String, dynamic>? parent])
  createApiContext;
  late final Map<String, dynamic> Function([Map<String, dynamic>? parent])
  createCasesMap;

  createCasesMap = ([Map<String, dynamic>? parent]) {
    final cases = <String, dynamic>{};

    registry.cases.forEach((
      String domain,
      Map<String, AppCaseSurfaces> domainCases,
    ) {
      final resolvedDomain = <String, dynamic>{};
      domainCases.forEach((String caseName, AppCaseSurfaces surfaces) {
        final entry = <String, dynamic>{};
        if (surfaces.api != null) {
          entry['apiHandler'] = (dynamic input) async {
            final context = createApiContext(parent);
            final instance = surfaces.api!(context) as dynamic;
            return instance.handler(input);
          };
          entry['api'] = <String, dynamic>{
            'handler': (dynamic input) async {
              final context = createApiContext(parent);
              final instance = surfaces.api!(context) as dynamic;
              return instance.handler(input);
            },
          };
        }
        resolvedDomain[caseName] = entry;
      });
      cases[domain] = resolvedDomain;
    });

    return cases;
  };

  createApiContext = ([Map<String, dynamic>? parent]) {
    final correlationId = parent?['correlationId']?.toString() ?? _generateId();
    final executionId = _generateId();
    final config = parent?['config'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(parent!['config'] as Map<String, dynamic>)
        : null;

    return ApiContext(
      correlationId: correlationId,
      executionId: executionId,
      tenantId: parent?['tenantId']?.toString(),
      userId: parent?['userId']?.toString(),
      config: config,
      logger: logger,
      packages: registry.packages,
      extra: <String, dynamic>{'providers': registry.providers},
      cases: createCasesMap(<String, dynamic>{
        'correlationId': correlationId,
        if (parent?['tenantId'] != null) 'tenantId': parent!['tenantId'],
        if (parent?['userId'] != null) 'userId': parent!['userId'],
        if (config != null) 'config': config,
        if (parent?['mcp'] != null) 'mcp': parent!['mcp'],
      }),
    );
  };

  AgenticContext createAgenticContext([Map<String, dynamic>? parent]) {
    final correlationId = parent?['correlationId']?.toString() ?? _generateId();
    final executionId = _generateId();
    final config = parent?['config'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(parent!['config'] as Map<String, dynamic>)
        : null;
    final mcpContext = parent?['mcp'] as AppMcpRequestContext?;

    return AgenticContext(
      correlationId: correlationId,
      executionId: executionId,
      tenantId: parent?['tenantId']?.toString(),
      userId: parent?['userId']?.toString(),
      config: config,
      logger: logger,
      packages: registry.packages,
      mcp: <String, dynamic>{
        'serverName': 'flutter-task-board-agent',
        'version': appVersion,
        'protocolVersion': mcpProtocolVersion,
        'transport': mcpContext?.transport ?? 'http',
        if (mcpContext?.sessionId != null) 'sessionId': mcpContext!.sessionId,
        if (mcpContext?.clientInfo != null)
          'clientInfo': mcpContext!.clientInfo!.toJson(),
      },
      extra: <String, dynamic>{'providers': registry.providers},
      cases: createCasesMap(<String, dynamic>{
        'correlationId': correlationId,
        if (parent?['tenantId'] != null) 'tenantId': parent!['tenantId'],
        if (parent?['userId'] != null) 'userId': parent!['userId'],
        if (config != null) 'config': config,
        if (mcpContext != null) 'mcp': mcpContext,
      }),
    );
  }

  List<AgenticCatalogEntry<dynamic, dynamic>> buildAgentCatalog([
    Map<String, dynamic>? parent,
  ]) {
    return registry.buildCatalog(createAgenticContext(parent));
  }

  AgenticCatalogEntry<dynamic, dynamic>? resolveTool(
    String toolName, [
    Map<String, dynamic>? parent,
  ]) {
    return registry.resolveTool(toolName, createAgenticContext(parent));
  }

  Future<dynamic> executeTool(
    String toolName,
    dynamic input, [
    Map<String, dynamic>? parent,
  ]) async {
    final entry = resolveTool(toolName, parent);
    if (entry == null) {
      throw AppCaseError(
        'NOT_FOUND',
        'Tool $toolName is not registered in apps/agent',
      );
    }

    if (entry.executionMode == 'suggest-only') {
      throw AppCaseError(
        'EXECUTION_MODE_RESTRICTED',
        'Tool ${entry.publishedName} cannot execute directly in suggest-only mode',
      );
    }

    if (entry.requiresConfirmation && parent?['confirmed'] != true) {
      throw AppCaseError(
        'CONFIRMATION_REQUIRED',
        'Tool ${entry.publishedName} requires explicit confirmation before execution',
        <String, dynamic>{
          'toolName': entry.publishedName,
          'executionMode': entry.executionMode,
        },
      );
    }

    final runtimeContext = createAgenticContext(parent);
    final runtimeEntry = registry.resolveTool(toolName, runtimeContext);
    if (runtimeEntry == null) {
      throw AppCaseError(
        'NOT_FOUND',
        'Tool $toolName could not be resolved at execution time',
      );
    }

    final runtimeTool = runtimeEntry.definition.tool as dynamic;
    final parsedInput = runtimeTool.coerceInput(input);
    return runtimeTool.execute(parsedInput, runtimeContext);
  }

  AgenticCatalogEntry<dynamic, dynamic>? resolveMcpTool(
    String toolName, [
    Map<String, dynamic>? parent,
  ]) {
    final entry = resolveTool(toolName, parent);
    if (entry == null || !entry.isMcpEnabled) {
      return null;
    }

    return entry;
  }

  String buildSystemPrompt([Map<String, dynamic>? parent]) {
    final catalog = buildAgentCatalog(parent)
      ..sort((
        AgenticCatalogEntry<dynamic, dynamic> left,
        AgenticCatalogEntry<dynamic, dynamic> right,
      ) {
        return left.publishedName.compareTo(right.publishedName);
      });
    final confirmationTools = catalog
        .where(
          (AgenticCatalogEntry<dynamic, dynamic> entry) =>
              entry.requiresConfirmation,
        )
        .map(
          (AgenticCatalogEntry<dynamic, dynamic> entry) => entry.publishedName,
        )
        .toList(growable: false);
    final suggestOnlyTools = catalog
        .where(
          (AgenticCatalogEntry<dynamic, dynamic> entry) =>
              entry.executionMode == 'suggest-only',
        )
        .map(
          (AgenticCatalogEntry<dynamic, dynamic> entry) => entry.publishedName,
        )
        .toList(growable: false);

    final sections = <String?>[
      'You are operating flutter-task-board-agent through the APP agent host.',
      'Use the registry-derived tool contracts exactly as published. Canonical execution always delegates through ctx.cases and the registered API surfaces.',
      confirmationTools.isEmpty
          ? 'No tools currently require confirmation.'
          : 'Tools requiring confirmation: ${confirmationTools.join(', ')}.',
      suggestOnlyTools.isEmpty
          ? null
          : 'Suggest-only tools: ${suggestOnlyTools.join(', ')}.',
      'Tool prompt fragments:',
      ...catalog.map(_buildToolPromptFragment),
    ];

    return sections
        .whereType<String>()
        .where((String value) => value.trim().isNotEmpty)
        .join('\n\n');
  }

  AppMcpServerInfo mcpServerInfo() {
    return AppMcpServerInfo(
      name: 'flutter-task-board-agent',
      version: appVersion,
      protocolVersion: mcpProtocolVersion,
      instructions: buildSystemPrompt(),
    );
  }

  Future<AppMcpInitializeResult> initializeMcp([
    AppMcpInitializeParams? params,
    AppMcpRequestContext? parent,
  ]) async {
    if (params != null &&
        !mcpSupportedProtocolVersions.contains(params.protocolVersion)) {
      throw AppMcpProtocolError(
        -32602,
        'Unsupported MCP protocol version ${params.protocolVersion}.',
        <String, dynamic>{'supported': mcpSupportedProtocolVersions},
      );
    }

    final info = mcpServerInfo();
    return AppMcpInitializeResult(
      protocolVersion: info.protocolVersion,
      capabilities: <String, dynamic>{
        'tools': <String, dynamic>{'listChanged': false},
        'resources': <String, dynamic>{'listChanged': false},
      },
      serverInfo: <String, dynamic>{'name': info.name, 'version': info.version},
      instructions: info.instructions,
    );
  }

  Future<List<AppMcpToolDescriptor>> listMcpTools([
    AppMcpRequestContext? parent,
  ]) async {
    final ctx = createAgenticContext(<String, dynamic>{
      if (parent != null) 'mcp': parent,
    });
    return registry
        .listMcpEnabledTools(ctx)
        .map(_toMcpToolDescriptor)
        .toList(growable: false);
  }

  Future<List<AppMcpResourceDescriptor>> listMcpResources([
    AppMcpRequestContext? parent,
  ]) async {
    final ctx = createAgenticContext(<String, dynamic>{
      if (parent != null) 'mcp': parent,
    });

    return <AppMcpResourceDescriptor>[
      _toMcpSystemPromptDescriptor(),
      ...registry
          .listMcpEnabledTools(ctx)
          .map(_toMcpSemanticResourceDescriptor),
    ];
  }

  Future<AppMcpReadResourceResult> readMcpResource(
    String uri, [
    AppMcpRequestContext? parent,
  ]) async {
    if (uri == _buildSystemPromptResourceUri()) {
      return AppMcpReadResourceResult(
        contents: <AppMcpTextResourceContent>[
          AppMcpTextResourceContent(
            uri: uri,
            text: buildSystemPrompt(<String, dynamic>{
              if (parent != null) 'mcp': parent,
            }),
            mimeType: 'text/markdown',
          ),
        ],
      );
    }

    final ctx = createAgenticContext(<String, dynamic>{
      if (parent != null) 'mcp': parent,
    });

    AgenticCatalogEntry<dynamic, dynamic>? matchedEntry;
    for (final candidate in registry.listMcpEnabledTools(ctx)) {
      if (_buildToolSemanticResourceUri(candidate) == uri) {
        matchedEntry = candidate;
        break;
      }
    }

    if (matchedEntry == null) {
      throw AppMcpProtocolError(
        -32004,
        'MCP resource $uri is not published by apps/agent.',
      );
    }

    final payload = <String, dynamic>{
      'app': 'flutter-example-agent',
      'ref': matchedEntry.ref.toJson(),
      'publishedName': matchedEntry.publishedName,
      'isMcpEnabled': matchedEntry.isMcpEnabled,
      'requiresConfirmation': matchedEntry.requiresConfirmation,
      'executionMode': matchedEntry.executionMode,
      'semanticSummary': _buildToolSemanticSummary(matchedEntry),
      'promptFragment': _buildToolPromptFragment(matchedEntry),
      'definition': _stripDefinitionForProjection(matchedEntry),
    };

    return AppMcpReadResourceResult(
      contents: <AppMcpTextResourceContent>[
        AppMcpTextResourceContent(
          uri: uri,
          text: const JsonEncoder.withIndent('  ').convert(payload),
          mimeType: 'application/json',
        ),
      ],
    );
  }

  Future<AppMcpCallResult> callMcpTool(
    String name,
    dynamic args, [
    AppMcpRequestContext? parent,
  ]) async {
    final envelope = _toExecutionEnvelope(args);

    try {
      final resolved = resolveMcpTool(name, <String, dynamic>{
        'confirmed': envelope['confirmed'],
        if (parent != null) 'mcp': parent,
      });

      if (resolved == null) {
        return _toMcpErrorResult(
          AppCaseError(
            'NOT_FOUND',
            'MCP tool $name is not published by apps/agent',
          ),
        );
      }

      final data = await executeTool(name, envelope['input'], <String, dynamic>{
        'confirmed': envelope['confirmed'],
        if (parent != null) 'mcp': parent,
      });

      return _toMcpSuccessResult(resolved.publishedName, data);
    } on AppCaseError catch (error) {
      return _toMcpErrorResult(error);
    }
  }

  Future<Map<String, int>> validateAgenticRuntime() async {
    final ctx = createAgenticContext(<String, dynamic>{
      'correlationId': 'agent-runtime-validation',
    });
    final catalog = registry.buildCatalog(ctx);

    if (catalog.isEmpty) {
      throw Exception('apps/agent must register at least one agentic tool');
    }

    final adapters = registry.providers['mcpAdapters'];
    if (adapters is! Map<String, dynamic> ||
        adapters['stdio'] == null ||
        adapters['http'] == null) {
      throw Exception(
        'apps/agent must register concrete MCP adapters in providers.mcpAdapters',
      );
    }

    final publishedNames = <String>{};
    for (final entry in catalog) {
      if (publishedNames.contains(entry.publishedName)) {
        throw Exception(
          'apps/agent published duplicate tool name ${entry.publishedName}',
        );
      }
      publishedNames.add(entry.publishedName);

      final resolved = registry.resolveTool(entry.publishedName, ctx);
      if (resolved == null) {
        throw Exception(
          'apps/agent failed to resolve published tool ${entry.publishedName}',
        );
      }

      final descriptor = _toMcpToolDescriptor(entry);
      if ((descriptor.description ?? '').trim().isEmpty) {
        throw Exception(
          'apps/agent failed to project semantic summary for ${entry.publishedName}',
        );
      }

      final promptFragment = _buildToolPromptFragment(entry);
      if (!promptFragment.contains(entry.definition.prompt.purpose)) {
        throw Exception(
          'apps/agent failed to project prompt fragment for ${entry.publishedName}',
        );
      }
    }

    for (final ref in registry.listAgenticCases()) {
      final instance = registry.instantiateAgentic(ref, ctx);
      await instance.test();
    }

    final globalPrompt = buildSystemPrompt(<String, dynamic>{
      'correlationId': 'agent-runtime-validation',
    });
    if (globalPrompt.trim().isEmpty) {
      throw Exception(
        'apps/agent must project a non-empty global system prompt',
      );
    }

    final resources = await listMcpResources(
      const AppMcpRequestContext(transport: 'validation'),
    );
    if (resources.length <
        catalog
                .where(
                  (AgenticCatalogEntry<dynamic, dynamic> entry) =>
                      entry.isMcpEnabled,
                )
                .length +
            1) {
      throw Exception(
        'apps/agent must publish a system prompt resource and one semantic resource per MCP-enabled tool',
      );
    }

    return <String, int>{
      'tools': catalog.length,
      'mcpEnabled': catalog
          .where(
            (AgenticCatalogEntry<dynamic, dynamic> entry) => entry.isMcpEnabled,
          )
          .length,
      'requireConfirmation': catalog
          .where(
            (AgenticCatalogEntry<dynamic, dynamic> entry) =>
                entry.requiresConfirmation,
          )
          .length,
    };
  }

  Future<void> publishMcp() async {
    await validateAgenticRuntime();
    final server = _RuntimeMcpServer(
      onServerInfo: mcpServerInfo,
      onInitialize: initializeMcp,
      onListTools: listMcpTools,
      onListResources: listMcpResources,
      onReadResource: readMcpResource,
      onCallTool: callMcpTool,
    );

    final adapters = registry.providers['mcpAdapters'] as Map<String, dynamic>;
    await (adapters['stdio'] as BaseAppMcpProcessAdapter).serve(server);
  }

  Future<bool> handleRemoteMcp(HttpRequest request) async {
    final adapters = registry.providers['mcpAdapters'];
    if (adapters is! Map<String, dynamic>) {
      return false;
    }

    final adapter = adapters['http'];
    if (adapter is! BaseAppMcpHttpAdapter) {
      return false;
    }

    if (request.uri.path != adapter.endpointPath) {
      return false;
    }

    String? bodyText;
    if (request.method.toUpperCase() == 'POST') {
      try {
        bodyText = await _readRawRequestBody(request);
      } catch (error) {
        _sendMcpHttpResponse(
          request.response,
          AppMcpHttpResponse(
            statusCode: 400,
            headers: const <String, String>{
              'cache-control': 'no-store',
              'content-type': 'application/json; charset=utf-8',
            },
            bodyText: jsonEncode(<String, dynamic>{
              'jsonrpc': '2.0',
              'id': null,
              'error': <String, dynamic>{
                'code': -32700,
                'message': error.toString(),
              },
            }),
          ),
        );
        return true;
      }
    }

    final exchange = AppMcpHttpExchange(
      method: request.method,
      path: request.uri.path,
      headers: _toHeaderMap(request.headers),
      bodyText: bodyText,
    );

    final server = _RuntimeMcpServer(
      onServerInfo: mcpServerInfo,
      onInitialize: initializeMcp,
      onListTools: listMcpTools,
      onListResources: listMcpResources,
      onReadResource: readMcpResource,
      onCallTool: callMcpTool,
    );

    final response =
        await adapter.handle(exchange, server) ??
        const AppMcpHttpResponse(
          statusCode: 404,
          headers: <String, String>{'cache-control': 'no-store'},
        );
    _sendMcpHttpResponse(request.response, response);
    return true;
  }

  Future<void> handleRequest(HttpRequest request) async {
    final path = request.uri.path;
    final method = request.method.toUpperCase();
    final pathSegments = path
        .split('/')
        .where((String segment) => segment.isNotEmpty)
        .toList(growable: false);

    if (method == 'OPTIONS') {
      request.response.statusCode = HttpStatus.noContent;
      request.response.headers.set('access-control-allow-origin', '*');
      request.response.headers.set(
        'access-control-allow-methods',
        'GET,POST,OPTIONS',
      );
      request.response.headers.set(
        'access-control-allow-headers',
        'content-type',
      );
      await request.response.close();
      return;
    }

    if (await handleRemoteMcp(request)) {
      return;
    }

    if (method == 'GET' && path == '/health') {
      _sendJson(request.response, HttpStatus.ok, <String, dynamic>{
        'ok': true,
        'app': 'flutter-example-agent',
        'status': 'ready',
      });
      return;
    }

    if (method == 'GET' && path == '/manifest') {
      final catalog = buildAgentCatalog();
      final adapters =
          registry.providers['mcpAdapters'] as Map<String, dynamic>;
      _sendJson(request.response, HttpStatus.ok, <String, dynamic>{
        'app': 'flutter-example-agent',
        'port': registry.providers['port'],
        'registeredDomains': registry.cases.keys.toList(growable: false),
        'packages': registry.packages.keys.toList(growable: false),
        'tools': catalog
            .map(
              (AgenticCatalogEntry<dynamic, dynamic> entry) =>
                  entry.publishedName,
            )
            .toList(growable: false),
        'mcpEnabledTools': catalog
            .where(
              (AgenticCatalogEntry<dynamic, dynamic> entry) =>
                  entry.isMcpEnabled,
            )
            .map(
              (AgenticCatalogEntry<dynamic, dynamic> entry) =>
                  entry.publishedName,
            )
            .toList(growable: false),
        'transports': <String, dynamic>{
          'http': true,
          'mcp': <String, dynamic>{
            'stdio': (adapters['stdio'] as BaseAppMcpAdapter).transport,
            'remote': (adapters['http'] as BaseAppMcpAdapter).transport,
            'remotePath':
                (adapters['http'] as BaseAppMcpHttpAdapter).endpointPath,
          },
        },
        'systemPrompt': buildSystemPrompt(),
      });
      return;
    }

    if (method == 'GET' && path == '/catalog') {
      final catalog = buildAgentCatalog();
      _sendJson(request.response, HttpStatus.ok, <String, dynamic>{
        'success': true,
        'data': <String, dynamic>{
          'systemPrompt': buildSystemPrompt(),
          'resources':
              (await listMcpResources(
                    const AppMcpRequestContext(transport: 'http'),
                  ))
                  .map((AppMcpResourceDescriptor item) => item.toJson())
                  .toList(growable: false),
          'tools': catalog.map(_toCatalogDocument).toList(growable: false),
        },
      });
      return;
    }

    if (method == 'POST' &&
        pathSegments.length == 3 &&
        pathSegments[0] == 'tools' &&
        pathSegments[2] == 'execute') {
      final toolName = Uri.decodeComponent(pathSegments[1]);
      dynamic body;

      try {
        body = await _readRequestBody(request);
      } catch (error) {
        _sendStructuredError(
          request.response,
          HttpStatus.badRequest,
          'INVALID_REQUEST',
          error.toString().replaceFirst('FormatException: ', ''),
        );
        return;
      }

      final envelope = _toExecutionEnvelope(body);

      try {
        final resolved = resolveTool(toolName, <String, dynamic>{
          'confirmed': envelope['confirmed'],
        });
        if (resolved == null) {
          throw AppCaseError(
            'NOT_FOUND',
            'Tool $toolName is not registered in apps/agent',
          );
        }

        final data = await executeTool(
          toolName,
          envelope['input'],
          <String, dynamic>{'confirmed': envelope['confirmed']},
        );

        _sendJson(request.response, HttpStatus.ok, <String, dynamic>{
          'success': true,
          'data': data,
          'meta': <String, dynamic>{
            'toolName': resolved.publishedName,
            'requiresConfirmation': resolved.requiresConfirmation,
            'executionMode': resolved.executionMode,
          },
        });
        return;
      } on AppCaseError catch (error) {
        _sendStructuredError(
          request.response,
          _mapErrorCodeToStatus(error.code),
          error.code,
          error.message,
          error.details,
        );
        return;
      } catch (error) {
        logger.error('Unhandled agent route error', <String, dynamic>{
          'error': error.toString(),
          'method': method,
          'path': path,
          'toolName': toolName,
        });

        _sendStructuredError(
          request.response,
          HttpStatus.internalServerError,
          'INTERNAL',
          'Internal agent scaffold error.',
        );
        return;
      }
    }

    _sendStructuredError(
      request.response,
      HttpStatus.notFound,
      'NOT_FOUND',
      'Route not found in agent scaffold.',
      <String, dynamic>{'method': method, 'path': path},
    );
  }

  Future<HttpServer> startAgent() async {
    final runtimeSummary = await validateAgenticRuntime();
    final server = await HttpServer.bind(
      InternetAddress.loopbackIPv4,
      registry.providers['port'] as int,
    );

    unawaited(
      server.forEach((HttpRequest request) async {
        await handleRequest(request);
      }),
    );

    logger.info('Agent scaffold started', <String, dynamic>{
      'port': server.port,
      ...runtimeSummary,
    });

    return server;
  }

  return AgentApp(
    registry: registry,
    createApiContext: createApiContext,
    createAgenticContext: createAgenticContext,
    buildAgentCatalog: buildAgentCatalog,
    resolveTool: resolveTool,
    executeTool: executeTool,
    validateAgenticRuntime: validateAgenticRuntime,
    buildSystemPrompt: buildSystemPrompt,
    mcpServerInfo: mcpServerInfo,
    initializeMcp: initializeMcp,
    listMcpTools: listMcpTools,
    listMcpResources: listMcpResources,
    readMcpResource: readMcpResource,
    callMcpTool: callMcpTool,
    publishMcp: publishMcp,
    handleRequest: handleRequest,
    startAgent: startAgent,
  );
}

final AgentApp app = bootstrap();
