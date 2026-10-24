export function pluralize(pattern: string, locale: string, count: number): string {
  const match = pattern.match(/^\{count,\s*plural,\s*([\s\S]+)\}$/);
  if (!match) return pattern;
  const forms: Record<string, string> = {};
  const re = /(zero|one|two|few|many|other)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(match[1])) !== null) forms[m[1]] = m[2];
  const rule = new Intl.PluralRules(locale).select(count);
  const template = forms[rule] ?? forms.other ?? "";
  return template.replace(/#/g, String(count));
}
