import 'domain.case.dart';
import 'shared/app_base_context.dart';

dynamic _serializeAgenticValue(dynamic value) {
  if (value == null || value is num || value is String || value is bool) {
    return value;
  }

  if (value is Map) {
    return value.map(
      (dynamic key, dynamic item) =>
          MapEntry(key.toString(), _serializeAgenticValue(item)),
    );
  }

  if (value is Iterable) {
    return value.map(_serializeAgenticValue).toList(growable: false);
  }

  try {
    return _serializeAgenticValue((value as dynamic).toJson());
  } catch (_) {
    return value.toString();
  }
}

class AgenticContext extends AppBaseContext {
  const AgenticContext({
    required super.correlationId,
    required super.logger,
    super.executionId,
    super.tenantId,
    super.userId,
    super.config,
    this.cases,
    this.packages,
    this.mcp,
    this.extra,
  });

  final Dict? cases;
  final Dict? packages;
  final dynamic mcp;
  final Dict? extra;
}

class AgenticDiscovery {
  const AgenticDiscovery({
    required this.name,
    required this.description,
    this.category,
    this.tags,
    this.aliases,
    this.capabilities,
    this.intents,
  });

  final String name;
  final String description;
  final String? category;
  final List<String>? tags;
  final List<String>? aliases;
  final List<String>? capabilities;
  final List<String>? intents;

  Dict toJson() {
    return {
      'name': name,
      'description': description,
      if (category != null) 'category': category,
      if (tags != null) 'tags': tags,
      if (aliases != null) 'aliases': aliases,
      if (capabilities != null) 'capabilities': capabilities,
      if (intents != null) 'intents': intents,
    };
  }
}

class AgenticExecutionContext {
  const AgenticExecutionContext({
    this.requiresAuth,
    this.requiresTenant,
    this.dependencies,
    this.preconditions,
    this.constraints,
    this.notes,
  });

  final bool? requiresAuth;
  final bool? requiresTenant;
  final List<String>? dependencies;
  final List<String>? preconditions;
  final List<String>? constraints;
  final List<String>? notes;

  Dict toJson() {
    return {
      if (requiresAuth != null) 'requiresAuth': requiresAuth,
      if (requiresTenant != null) 'requiresTenant': requiresTenant,
      if (dependencies != null) 'dependencies': dependencies,
      if (preconditions != null) 'preconditions': preconditions,
      if (constraints != null) 'constraints': constraints,
      if (notes != null) 'notes': notes,
    };
  }
}

class AgenticPrompt {
  const AgenticPrompt({
    required this.purpose,
    this.whenToUse,
    this.whenNotToUse,
    this.constraints,
    this.reasoningHints,
    this.expectedOutcome,
  });

  final String purpose;
  final List<String>? whenToUse;
  final List<String>? whenNotToUse;
  final List<String>? constraints;
  final List<String>? reasoningHints;
  final String? expectedOutcome;

  Dict toJson() {
    return {
      'purpose': purpose,
      if (whenToUse != null) 'whenToUse': whenToUse,
      if (whenNotToUse != null) 'whenNotToUse': whenNotToUse,
      if (constraints != null) 'constraints': constraints,
      if (reasoningHints != null) 'reasoningHints': reasoningHints,
      if (expectedOutcome != null) 'expectedOutcome': expectedOutcome,
    };
  }
}

typedef AgenticToolExecutor<TInput, TOutput> =
    Future<TOutput> Function(TInput input, AgenticContext ctx);
typedef AgenticInputParser<TInput> = TInput Function(dynamic value);

class AgenticToolContract<TInput, TOutput> {
  const AgenticToolContract({
    required this.name,
    required this.description,
    required this.inputSchema,
    required this.outputSchema,
    required this.execute,
    this.parseInput,
    this.isMutating,
    this.requiresConfirmation,
  });

  final String name;
  final String description;
  final AppSchema inputSchema;
  final AppSchema outputSchema;
  final AgenticInputParser<TInput>? parseInput;
  final bool? isMutating;
  final bool? requiresConfirmation;
  final AgenticToolExecutor<TInput, TOutput> execute;

  TInput coerceInput(dynamic value) {
    return parseInput != null ? parseInput!(value) : value as TInput;
  }

  Dict toJson() {
    return {
      'name': name,
      'description': description,
      'inputSchema': inputSchema,
      'outputSchema': outputSchema,
      if (isMutating != null) 'isMutating': isMutating,
      if (requiresConfirmation != null)
        'requiresConfirmation': requiresConfirmation,
    };
  }
}

class AgenticMcpContract {
  const AgenticMcpContract({
    this.enabled,
    this.name,
    this.title,
    this.description,
    this.metadata,
  });

  final bool? enabled;
  final String? name;
  final String? title;
  final String? description;
  final Dict? metadata;

  Dict toJson() {
    return {
      if (enabled != null) 'enabled': enabled,
      if (name != null) 'name': name,
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      if (metadata != null) 'metadata': metadata,
    };
  }
}

typedef RagResourceKind = String;

class RagResource {
  const RagResource({required this.kind, required this.ref, this.description});

  final RagResourceKind kind;
  final String ref;
  final String? description;

  Dict toJson() {
    return {
      'kind': kind,
      'ref': ref,
      if (description != null) 'description': description,
    };
  }
}

class AgenticRagContract {
  const AgenticRagContract({
    this.topics,
    this.resources,
    this.hints,
    this.scope,
    this.mode,
  });

  final List<String>? topics;
  final List<RagResource>? resources;
  final List<String>? hints;
  final String? scope;
  final String? mode;

  Dict toJson() {
    return {
      if (topics != null) 'topics': topics,
      if (resources != null)
        'resources': resources!
            .map((item) => item.toJson())
            .toList(growable: false),
      if (hints != null) 'hints': hints,
      if (scope != null) 'scope': scope,
      if (mode != null) 'mode': mode,
    };
  }
}

class AgenticPolicy {
  const AgenticPolicy({
    this.requireConfirmation,
    this.requireAuth,
    this.requireTenant,
    this.riskLevel,
    this.executionMode,
    this.limits,
  });

  final bool? requireConfirmation;
  final bool? requireAuth;
  final bool? requireTenant;
  final String? riskLevel;
  final String? executionMode;
  final List<String>? limits;

  Dict toJson() {
    return {
      if (requireConfirmation != null)
        'requireConfirmation': requireConfirmation,
      if (requireAuth != null) 'requireAuth': requireAuth,
      if (requireTenant != null) 'requireTenant': requireTenant,
      if (riskLevel != null) 'riskLevel': riskLevel,
      if (executionMode != null) 'executionMode': executionMode,
      if (limits != null) 'limits': limits,
    };
  }
}

class AgenticExample<TInput, TOutput> {
  const AgenticExample({
    required this.name,
    required this.input,
    required this.output,
    this.description,
    this.notes,
  });

  final String name;
  final String? description;
  final TInput input;
  final TOutput output;
  final List<String>? notes;

  Dict toJson() {
    return {
      'name': name,
      if (description != null) 'description': description,
      'input': _serializeAgenticValue(input),
      'output': _serializeAgenticValue(output),
      if (notes != null) 'notes': notes,
    };
  }
}

class AgenticDefinition<TInput, TOutput> {
  const AgenticDefinition({
    required this.discovery,
    required this.context,
    required this.prompt,
    required this.tool,
    this.mcp,
    this.rag,
    this.policy,
    this.examples,
  });

  final AgenticDiscovery discovery;
  final AgenticExecutionContext context;
  final AgenticPrompt prompt;
  final AgenticToolContract<TInput, TOutput> tool;
  final AgenticMcpContract? mcp;
  final AgenticRagContract? rag;
  final AgenticPolicy? policy;
  final List<AgenticExample<TInput, TOutput>>? examples;

  Dict toJson() {
    return {
      'discovery': discovery.toJson(),
      'context': context.toJson(),
      'prompt': prompt.toJson(),
      'tool': tool.toJson(),
      if (mcp != null) 'mcp': mcp!.toJson(),
      if (rag != null) 'rag': rag!.toJson(),
      if (policy != null) 'policy': policy!.toJson(),
      if (examples != null)
        'examples': examples!
            .map((item) => item.toJson())
            .toList(growable: false),
    };
  }
}

abstract class BaseAgenticCase<TInput, TOutput> {
  BaseAgenticCase(this.ctx);

  final AgenticContext ctx;

  BaseDomainCase<TInput, TOutput>? domain() {
    return null;
  }

  AgenticDiscovery discovery();

  AgenticExecutionContext context();

  AgenticPrompt prompt();

  AgenticToolContract<TInput, TOutput> tool();

  Future<void> test() async {}

  AgenticMcpContract? mcp() {
    return null;
  }

  AgenticRagContract? rag() {
    return null;
  }

  AgenticPolicy? policy() {
    return null;
  }

  List<AgenticExample<TInput, TOutput>> examples() {
    return _domainExamples() ?? const [];
  }

  String? domainDescription() => domain()?.description();

  String? domainCaseName() => domain()?.caseName();

  AppSchema? domainInputSchema() => domain()?.inputSchema();

  AppSchema? domainOutputSchema() => domain()?.outputSchema();

  List<AgenticExample<TInput, TOutput>>? _domainExamples() {
    final examples = domain()?.examples() ?? <DomainExample<TInput, TOutput>>[];
    if (examples.isEmpty) {
      return null;
    }

    return examples
        .where((item) => item.output != null)
        .map(
          (item) => AgenticExample<TInput, TOutput>(
            name: item.name,
            description: item.description,
            input: item.input,
            output: item.output as TOutput,
            notes: item.notes,
          ),
        )
        .toList(growable: false);
  }

  AgenticDefinition<TInput, TOutput> definition() {
    return AgenticDefinition(
      discovery: discovery(),
      context: context(),
      prompt: prompt(),
      tool: tool(),
      mcp: mcp(),
      rag: rag(),
      policy: policy(),
      examples: examples(),
    );
  }

  Future<TOutput> execute(TInput input) {
    return tool().execute(input, ctx);
  }

  bool isMcpEnabled() {
    final contract = mcp();
    return contract != null && contract.enabled != false;
  }

  bool requiresConfirmation() {
    return (policy()?.requireConfirmation ?? false) ||
        (tool().requiresConfirmation ?? false);
  }

  String caseName() {
    return discovery().name.isNotEmpty
        ? discovery().name
        : domainCaseName() ?? 'unknown_case';
  }

  void validateDefinition() {
    final discoveryDefinition = discovery();
    if (discoveryDefinition.name.trim().isEmpty) {
      throw Exception('validateDefinition: discovery.name is empty');
    }

    if (discoveryDefinition.description.trim().isEmpty) {
      throw Exception('validateDefinition: discovery.description is empty');
    }

    final toolDefinition = tool();
    if (toolDefinition.name.trim().isEmpty) {
      throw Exception('validateDefinition: tool.name is empty');
    }

    if (toolDefinition.description.trim().isEmpty) {
      throw Exception('validateDefinition: tool.description is empty');
    }

    final promptDefinition = prompt();
    if (promptDefinition.purpose.trim().isEmpty) {
      throw Exception('validateDefinition: prompt.purpose is empty');
    }

    final mcpDefinition = mcp();
    if (mcpDefinition?.enabled == true &&
        (mcpDefinition?.name == null || mcpDefinition!.name!.trim().isEmpty)) {
      throw Exception('validateDefinition: mcp.enabled but mcp.name is empty');
    }
  }
}
