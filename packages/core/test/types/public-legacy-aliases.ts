import type { SortsParseError, SortsSchema } from '@rapiq/core';
import { SortParseError, SortSchema } from '@rapiq/core';

const schema: SortSchema = new SortSchema({ allowed: ['id'] });
const currentSchema: SortsSchema = schema;
const error: SortParseError = SortParseError.inputInvalid();
const currentError: SortsParseError = error;

void currentSchema;
void currentError;
