# German Study Context

## Domain Terms

### Vocabulary entry

A lexical item the learner wants to study. One vocabulary entry can create several study cards, such as German-to-English recall and article practice.

### Study card

A schedulable prompt generated from a vocabulary entry. Study cards share review history even when the vocabulary entry appears in multiple notebooks.

### Notebook

A named collection of vocabulary entries. A vocabulary entry can belong to multiple notebooks, so importing a duplicate word into a new notebook links the existing entry instead of creating another copy.

### Study focus

The currently selected notebook for review and article practice. When no notebook is selected, study focus covers all notebooks.

### Practice policy

The module that decides which study cards a vocabulary entry creates, which review mode owns each card, and how prompts are rendered.

### Vocabulary authoring schema

The module that owns vocabulary draft defaults, shared select options, import headers, and the validation expectations shown by authoring screens.

### Study persistence

The seam between local study commands and storage adapters. It owns snapshots, batch writes, review recording, and cascade deletion rules.

### Route workspace

A learner workflow module under `src/app/routes/`. Each route workspace owns one major app surface such as dashboard, review, words, notebooks, DW, import, or settings.

### DW source

A curated Deutsche Welle learning page or course used as context while the learner manually saves vocabulary with attribution.

### DW source acquisition

The module that owns curated DW source metadata, filtering, source lookup, and source-to-vocabulary or source-to-notebook draft mapping.
