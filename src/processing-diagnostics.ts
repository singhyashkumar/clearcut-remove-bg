type ErrorDetails = { code?: unknown; name?: unknown; message?: unknown; cause?: unknown };

export function errorDetails(error: unknown): ErrorDetails {
 return (typeof error === 'object' && error !== null ? error : {}) as ErrorDetails;
}

export function processingFailure(failure: unknown, stage = 'preparing', provider = 'unknown') {
 const error = errorDetails(failure);
 const code = typeof error?.code === 'string' ? error.code : 'processing-failed';
 const message = typeof error?.message === 'string' ? error.message : 'Local processing could not finish.';
 const causes = [];
 let cause = error?.cause;
 for (let i=0; cause && i<3; i++, cause=errorDetails(cause).cause) {
  const { message } = errorDetails(cause);
  if (typeof message === 'string') causes.push(message);
 }
 const details = causes.join(' → ').replace(/https?:\/\/[^\s"')]+/g, '[asset URL]').slice(0,600);
 return `${message} [${code}; ${stage}; ${provider}]${details ? ` Details: ${details}` : ''}`;
}
