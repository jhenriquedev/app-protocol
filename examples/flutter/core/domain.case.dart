import 'dart:convert';

typedef Dict = Map<String, dynamic>;
typedef AppSchema = Map<String, dynamic>;

class DomainExample<TInput, TOutput> {
  const DomainExample({
    required this.name,
    required this.input,
    this.description,
    this.output,
    this.notes,
  });

  final String name;
  final String? description;
  final TInput input;
  final TOutput? output;
  final List<String>? notes;
}

abstract class ValueObject<TProps> {
  ValueObject(TProps props) : props = _freeze(props);

  final TProps props;

  static T _freeze<T>(T value) {
    if (value is Map) {
      return Map<String, dynamic>.unmodifiable(
            value.map((key, item) => MapEntry(key.toString(), item)),
          )
          as T;
    }

    if (value is List) {
      return List<dynamic>.unmodifiable(value) as T;
    }

    return value;
  }

  TProps toJson() => props;

  bool equals(ValueObject<TProps>? other) {
    if (other == null) {
      return false;
    }

    return jsonEncode(props) == jsonEncode(other.props);
  }
}

abstract class BaseDomainCase<TInput, TOutput> {
  String caseName();

  String description();

  AppSchema inputSchema();

  AppSchema outputSchema();

  void validate(TInput input) {}

  List<String> invariants() => const [];

  Dict valueObjects() => const {};

  Dict enums() => const {};

  List<DomainExample<TInput, TOutput>> examples() => const [];

  Future<void> test() async {}

  Dict definition() {
    return {
      'caseName': caseName(),
      'description': description(),
      'inputSchema': inputSchema(),
      'outputSchema': outputSchema(),
      'invariants': invariants(),
      'valueObjects': valueObjects(),
      'enums': enums(),
      'examples': examples()
          .map(
            (example) => {
              'name': example.name,
              if (example.description != null)
                'description': example.description,
              'input': example.input,
              if (example.output != null) 'output': example.output,
              if (example.notes != null) 'notes': example.notes,
            },
          )
          .toList(growable: false),
    };
  }
}
