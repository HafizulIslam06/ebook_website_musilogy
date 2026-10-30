import { AppError } from '../errors.js';

// Parses req[source] with a zod schema and adds the result to req.valid.
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        fields[key] ??= issue.message;
      }
      throw new AppError(400, 'Please check the highlighted fields', fields);
    }
    req.valid = { ...req.valid, ...result.data };
    next();
  };
}
