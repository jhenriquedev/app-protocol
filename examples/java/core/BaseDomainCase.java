package core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public abstract class BaseDomainCase<TInput, TOutput> {
  public static final class AppSchema extends LinkedHashMap<String, Object> {
    public static AppSchema object() {
      return new AppSchema().type("object");
    }

    public static AppSchema array(AppSchema items) {
      return new AppSchema().type("array").items(items);
    }

    public static AppSchema string() {
      return new AppSchema().type("string");
    }

    public AppSchema type(String value) {
      put("type", value);
      return this;
    }

    public AppSchema description(String value) {
      if (value != null) {
        put("description", value);
      }
      return this;
    }

    public AppSchema property(String name, AppSchema schema) {
      @SuppressWarnings("unchecked")
      Map<String, Object> properties =
          (Map<String, Object>) computeIfAbsent("properties", key -> new LinkedHashMap<>());
      properties.put(name, schema);
      return this;
    }

    public AppSchema items(AppSchema schema) {
      put("items", schema);
      return this;
    }

    public AppSchema required(String... names) {
      List<String> values = new ArrayList<>();
      for (String name : names) {
        values.add(name);
      }
      put("required", values);
      return this;
    }

    public AppSchema enumValues(String... names) {
      List<String> values = new ArrayList<>();
      for (String name : names) {
        values.add(name);
      }
      put("enum", values);
      return this;
    }

    public AppSchema additionalProperties(boolean value) {
      put("additionalProperties", value);
      return this;
    }
  }

  public static class DomainExample<TInput, TOutput> {
    public String name;
    public String description;
    public TInput input;
    public TOutput output;
    public List<String> notes = List.of();
  }

  public abstract static class ValueObject<TProps> {
    protected final TProps props;

    protected ValueObject(TProps props) {
      this.props = props;
    }

    public TProps toJson() {
      return props;
    }

    @Override
    public boolean equals(Object other) {
      if (!(other instanceof ValueObject<?> valueObject)) {
        return false;
      }

      return Objects.equals(props, valueObject.props);
    }

    @Override
    public int hashCode() {
      return Objects.hashCode(props);
    }
  }

  public abstract String caseName();
  public abstract String description();
  public abstract AppSchema inputSchema();
  public abstract AppSchema outputSchema();

  public void validate(TInput input) throws Exception {}

  public List<String> invariants() {
    return List.of();
  }

  public Map<String, Object> valueObjects() {
    return Map.of();
  }

  public Map<String, Object> enums() {
    return Map.of();
  }

  public List<DomainExample<TInput, TOutput>> examples() {
    return List.of();
  }

  public void test() throws Exception {}

  public Map<String, Object> definition() {
    Map<String, Object> definition = new LinkedHashMap<>();
    definition.put("caseName", caseName());
    definition.put("description", description());
    definition.put("inputSchema", inputSchema());
    definition.put("outputSchema", outputSchema());
    definition.put("invariants", invariants());
    definition.put("valueObjects", valueObjects());
    definition.put("enums", enums());
    definition.put("examples", examples());
    return definition;
  }
}
