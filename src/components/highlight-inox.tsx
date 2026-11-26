export function HighlightInox({ text }: { text: string }) {
  return text.split(/(\bINOX\b)/gi).map((part, index) =>
    /^INOX$/i.test(part) ? (
      <mark className="inox-word" key={index}>{part}</mark>
    ) : part,
  );
}
