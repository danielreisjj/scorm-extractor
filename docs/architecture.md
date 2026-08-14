# Architecture

## Layers

```
extract(source, options)
  → load bytes
  → ZipPackageReader (zip-slip + size limit)
  → FormatDetector
  → ParserRegistry.resolve(format)
  → PackageParser.parse → ExtractionResult
  → Zod validate at the boundary
```

| Layer | Responsibility |
| --- | --- |
| `src/index.ts` | Public surface: `extract`, `toJSON`, errors, types |
| `domain/` | Models, errors, ports — no infrastructure imports |
| `application/` | `extractPackage` use case |
| `infrastructure/` | ZIP, detector, asset loader, parsers, HTML linearizer |

## HoApp pipeline

1. Read `js/data.js`
2. Detect dialect A (`new SectionEditable`) vs B (`type: 'as-…'`)
3. Build IR (course, components, sections)
4. Expand interactive components (accordion, quiz, …) into HTML
5. Dedupe desktop/tablet/mobile duplicates
6. Linearize DOM → text + markers
7. Load bytes per `includeBytes`
8. Set `kind: "quiz"` when Assessment/Question is present

Never `eval` / `new Function` package JavaScript.

## Adding a parser

1. Fingerprint in `format-detector.ts` (clear `detectedFormat` while unsupported).
2. Implement `PackageParser` under `src/infrastructure/parsers/<format>/` returning the **same** `ExtractionResult`.
3. Register in `registry.ts`.
4. Add a unit fixture and, if useful, an optional integration package (tests may skip when fixtures are absent).

Do not change marker semantics or break `domain/` isolation.
