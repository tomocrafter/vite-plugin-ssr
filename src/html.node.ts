import { assert, assertUsage, cast, hasProp } from './utils'

export { html }
export { renderHtmlTemplate }
export { isHtmlTemplate }

html.dangerouslySetHtml = dangerouslySetHtml

const __html_template = Symbol('__html_template')
const __dangerouslySetHtml = Symbol('__dangerouslySetHtml')

type SanitizedHtmlString = {
  [__html_template]: {
    templateParts: TemplateStringsArray
    templateVariables: (
      | any
      | {
          [__dangerouslySetHtml]: string
        }
    )[]
  }
}
type TemplateString = TemplateStringsArray
function html(
  templateString: TemplateString,
  ...templateVariables: (string | ReturnType<typeof html.dangerouslySetHtml>)[]
): SanitizedHtmlString {
  return {
    [__html_template]: {
      templateParts: templateString,
      templateVariables
    }
  }
}
type SanitizedString = { [__dangerouslySetHtml]: string }
function dangerouslySetHtml(alreadySanitizedString: string): SanitizedString {
  return { [__dangerouslySetHtml]: alreadySanitizedString }
}

function isHtmlTemplate(something: unknown): something is { [__html_template]: HtmlTemplate } {
  return hasProp(something, __html_template)
}
function renderHtmlTemplate(renderResult: { [__html_template]: HtmlTemplate }, filePath: string): string {
  return renderHtml(renderResult[__html_template], filePath)
}

type HtmlTemplate = {
  templateParts: TemplateStringsArray
  templateVariables: unknown[]
}
function renderHtml(htmlTemplate: HtmlTemplate, filePath: string) {
  const { templateParts, templateVariables } = htmlTemplate
  const templateVariablesUnwrapped: string[] = templateVariables.map((templateVar: unknown) => {
    // Process `html.dangerouslySetHtml()`
    if (hasProp(templateVar, __dangerouslySetHtml)) {
      const val = templateVar[__dangerouslySetHtml]
      assertUsage(
        typeof val === 'string',
        `[html.dangerouslySetHtml(str)] Argument \`str\` should be a string but we got \`typeof str === "${typeof val}"\`. (While executing the \`render()\` hook exported by ${filePath})`
      )
      // User used `html.dangerouslySetHtml()` so we assume the string to be safe
      return val
    }

    // Process `html` tag composition
    if (hasProp(templateVar, __html_template)) {
      const htmlTemplate__segment = templateVar[__html_template]
      cast<HtmlTemplate>(htmlTemplate__segment)
      return renderHtml(htmlTemplate__segment, filePath)
    }

    // Process and sanitize untrusted template variable
    return escapeHtml(toString(templateVar))
  })
  const htmlString = identityTemplateTag(templateParts, ...templateVariablesUnwrapped)
  return htmlString
}

function identityTemplateTag(parts: TemplateStringsArray, ...variables: string[]) {
  assert(parts.length === variables.length + 1)
  let str = ''
  for (let i = 0; i < variables.length; i++) {
    const variable = variables[i]
    assert(typeof variable === 'string')
    str += parts[i] + variable
  }
  return str + parts[parts.length - 1]
}

function toString(val: unknown): string {
  if (val === null || val === undefined) {
    return ''
  }
  return String(val)
}

function escapeHtml(unsafeString: string): string {
  // Source: https://stackoverflow.com/questions/6234773/can-i-escape-html-special-chars-in-javascript/6234804#6234804
  const safe = unsafeString
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
  return safe
}
