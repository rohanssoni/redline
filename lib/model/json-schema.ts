/**
 * The slice of JSON Schema the model calls actually use, plus a checker for it.
 *
 * Every model call in Redline asks for structured output, so what comes back has
 * to be checked against the schema we asked for before anything downstream trusts
 * it. This is deliberately small: objects, arrays, strings, numbers, booleans,
 * enums, and required keys. Nothing here is a general-purpose validator.
 */

export type JsonSchema =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | ArraySchema
  | ObjectSchema;

export interface StringSchema {
  type: 'string';
  description?: string;
  enum?: string[];
  minLength?: number;
}

export interface NumberSchema {
  type: 'number' | 'integer';
  description?: string;
  minimum?: number;
  maximum?: number;
}

export interface BooleanSchema {
  type: 'boolean';
  description?: string;
}

export interface ArraySchema {
  type: 'array';
  description?: string;
  items: JsonSchema;
}

export interface ObjectSchema {
  type: 'object';
  description?: string;
  properties: Record<string, JsonSchema>;
  required: string[];
  additionalProperties: false;
}

/** Where a mismatch was found, and what was wrong with it. */
export interface SchemaProblem {
  path: string;
  message: string;
}

/**
 * Collects everything wrong with `value` against `schema`. An empty array means
 * the value matches.
 */
export function checkAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  path = 'output',
): SchemaProblem[] {
  switch (schema.type) {
    case 'string':
      return checkString(value, schema, path);
    case 'number':
    case 'integer':
      return checkNumber(value, schema, path);
    case 'boolean':
      return typeof value === 'boolean'
        ? []
        : [{ path, message: `expected a boolean, got ${describe(value)}` }];
    case 'array':
      return checkArray(value, schema, path);
    case 'object':
      return checkObject(value, schema, path);
  }
}

function checkString(
  value: unknown,
  schema: StringSchema,
  path: string,
): SchemaProblem[] {
  if (typeof value !== 'string') {
    return [{ path, message: `expected a string, got ${describe(value)}` }];
  }
  const problems: SchemaProblem[] = [];
  if (schema.enum && !schema.enum.includes(value)) {
    problems.push({
      path,
      message: `expected one of ${schema.enum.join(', ')}, got ${JSON.stringify(value)}`,
    });
  }
  if (schema.minLength !== undefined && value.trim().length < schema.minLength) {
    problems.push({
      path,
      message: `expected at least ${schema.minLength} characters, got ${value.trim().length}`,
    });
  }
  return problems;
}

function checkNumber(
  value: unknown,
  schema: NumberSchema,
  path: string,
): SchemaProblem[] {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return [{ path, message: `expected a number, got ${describe(value)}` }];
  }
  const problems: SchemaProblem[] = [];
  if (schema.type === 'integer' && !Number.isInteger(value)) {
    problems.push({ path, message: `expected a whole number, got ${value}` });
  }
  if (schema.minimum !== undefined && value < schema.minimum) {
    problems.push({ path, message: `expected at least ${schema.minimum}, got ${value}` });
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    problems.push({ path, message: `expected at most ${schema.maximum}, got ${value}` });
  }
  return problems;
}

function checkArray(
  value: unknown,
  schema: ArraySchema,
  path: string,
): SchemaProblem[] {
  if (!Array.isArray(value)) {
    return [{ path, message: `expected an array, got ${describe(value)}` }];
  }
  return value.flatMap((item, index) =>
    checkAgainstSchema(item, schema.items, `${path}[${index}]`),
  );
}

function checkObject(
  value: unknown,
  schema: ObjectSchema,
  path: string,
): SchemaProblem[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [{ path, message: `expected an object, got ${describe(value)}` }];
  }
  const record = value as Record<string, unknown>;
  const problems: SchemaProblem[] = [];

  for (const key of schema.required) {
    if (!(key in record)) {
      problems.push({ path: `${path}.${key}`, message: 'missing' });
    }
  }
  for (const [key, propertySchema] of Object.entries(schema.properties)) {
    if (key in record) {
      problems.push(
        ...checkAgainstSchema(record[key], propertySchema, `${path}.${key}`),
      );
    }
  }
  for (const key of Object.keys(record)) {
    if (!(key in schema.properties)) {
      problems.push({ path: `${path}.${key}`, message: 'not part of the schema' });
    }
  }
  return problems;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value;
}
