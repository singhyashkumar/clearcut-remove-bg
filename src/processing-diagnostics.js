export function processingFailure(error, stage = 'preparing', provider = 'unknown') {
 const code = typeof error?.code === 'string' ? error.code : 'processing-failed';
 const message = typeof error?.message === 'string' ? error.message : 'Local processing could not finish.';
 const causes = [];
 let cause = error?.cause;
 for (let i=0; cause && i<3; i++, cause=cause.cause) {
  if (typeof cause.message === 'string') causes.push(cause.message);
 }
 const details = causes.join(' → ').replace(/https?:\/\/[^\s"')]+/g, '[asset URL]').slice(0,600);
 return `${message} [${code}; ${stage}; ${provider}]${details ? ` Details: ${details}` : ''}`;
}
