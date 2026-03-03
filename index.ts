import type { ProcessingContext } from '@data-fair/lib-common-types/processings.js'

/**
 * Function to execute the processing (triggered when the processing is started).
 * This is the main function of the plugin where the business logic is implemented.
 */
export const run = async (context: ProcessingContext) => {
  const { run } = await import('./lib/execute.ts')
  return run(context)
}
