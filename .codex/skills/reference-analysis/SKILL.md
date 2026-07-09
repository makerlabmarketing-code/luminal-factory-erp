---
name: reference-analysis
description: Analyze one or more websites as design, motion, interaction, product, or engineering references for Luminal Factory. Extract useful patterns, document behavior, identify technical approaches, and propose Luminal-specific adaptations under repository-owned authority.
argument-hint: "<url1> [<url2> ...]"
user-invocable: true
---

# Website Reference Analysis

Analyze one or more websites provided in `$ARGUMENTS` as references for Luminal Factory.

This skill is for research and adaptation. It records evidence, extracts useful patterns, and adapts them under repository-owned authority.

The objective is to understand:

- what the reference does
- how the experience behaves
- why the behavior works
- which technical approach may be involved
- what is useful for Luminal Factory
- what must not be copied
- how the concept should be adapted to Luminal's identity

Use the full workflow when the reference may affect project direction, a page specification, a motion system, product structure, or implementation planning.

For a quick scan, identify only the requested scope, observed behavior, useful principle, what should not be copied, and Luminal adaptation.

For ERP operational references, focus on workflow clarity, state visibility, task flow, information density, tables, forms, permissions, and traceability before visual style.

## Core Rule

Treat reference websites as evidence, not final design authority.

Luminal Factory's repository-owned project context, ERP domain rules, architecture, UI rules, workflow rules, and user-approved scope are authoritative.

Authority order is owned by `AGENTS.md`.

A reference may contribute:

- interaction logic
- motion architecture
- layout principle
- information hierarchy
- technical pattern
- component behavior
- spatial composition
- product structure

A reference may not override repository-owned Luminal guidance for:

- branding
- logos
- brand colors
- product names
- copy
- images
- videos
- proprietary assets
- complete page composition
- exact typography system
- full visual identity

## Luminal Context

Before analyzing a reference for implementation use, consult the relevant Luminal ERP guidance.

Relevant project guidance lives in:

    .agents/skills/luminal-erp/

At minimum, consider:

    references/project-context.md
    references/ui-rules.md

For ERP domain or workflow references, also consult:

    references/erp-domain.md
    references/workflow.md

For architectural references, also consult:

    references/architecture.md

ERP visual stability is owned by `references/ui-rules.md`. ERP business meaning is owned by `references/erp-domain.md`.

## Analysis Modes

Determine the most relevant analysis mode from the user's request.

Possible modes include:

- visual
- motion
- interaction
- 3D
- layout
- product structure
- content structure
- engineering architecture
- component behavior

A reference may use multiple modes.

Analyze only the modes that match the user's request or the Luminal feature being considered.

For ERP references, prefer these modes before visual or motion modes:

- workflow
- information hierarchy
- state presentation
- form behavior
- table behavior
- permissions and role boundaries
- audit or traceability model

## Browser Inspection

When browser automation is available, inspect the live reference directly.

When browser automation is not available, use available page content, screenshots, recordings, prompts, source descriptions, or user-provided files.

Be explicit when a conclusion is inferred rather than directly observed.

Do not claim to know the site's internal implementation solely from appearance.

For example:

    observed:
    the object rotates toward the pointer

is different from:

    inferred:
    this may use camera orbit or object rotation

When source code or an implementation prompt is available, use it to validate the technical conclusion.

## Phase 1: Reference Scope

Identify:

1. The reference URL.
2. The exact page or section being studied.
3. The requested analysis mode.
4. The Luminal page or feature that may use the reference.

Examples:

    Soda hero
    -> 3D and pointer interaction
    -> Luminal ERP dashboard header

    Aixor project sections
    -> editorial composition
    -> Luminal ERP dashboard information hierarchy

Keep the scope to the referenced page, section, or interaction unless the user asks for a broader audit.

## Phase 2: Observe the Experience

Document the experience as a sequence.

For example:

    page loads
    central object appears
    pointer movement changes object orientation
    foreground objects move faster than background objects
    pointer proximity moves nearby objects
    user selects a state
    background changes
    main object transitions
    surrounding elements reorganize

Use behavioral descriptions before discussing implementation.

## Phase 3: Identify the Interaction Model

For each relevant behavior, identify its trigger.

Possible triggers:

- initial load
- pointer position
- pointer proximity
- hover
- click
- drag
- scroll position
- viewport entry
- time
- route navigation
- application state

Document interactions in this form:

    Behavior:
    Central product tilt

    Trigger:
    Pointer movement

    Input:
    Pointer X and Y normalized to viewport

    Response:
    Object or camera orientation changes

    Settle behavior:
    Smoothed interpolation

Describe the trigger, input, response, and settle behavior for each relevant interaction.

## Phase 4: Identify Spatial Layers

For visually rich sections, map the depth structure.

Example:

    far background
    background decorative objects
    typography
    main object
    foreground objects
    interface controls

For every layer, identify:

- role
- approximate depth
- pointer response
- scroll response
- z-index relationship
- whether it is 2D or 3D when known

Example:

    Far layer
    - decorative crystal fragments
    - slow inverse pointer movement
    - low contrast

    Center layer
    - hero object
    - primary pointer response

    Front layer
    - larger refractive fragments
    - stronger pointer movement
    - partially blurred

## Phase 5: Motion Breakdown

For each important motion, document:

### Trigger

What starts the motion?

### Start State

What is visible before the motion?

### Transition

What changes?

Examples:

- position
- rotation
- scale
- opacity
- camera orbit
- material
- texture
- background
- blur
- clipping
- mask

### Settle

How does the movement end?

Possible qualities:

- immediate
- linear
- damped
- spring-like
- overshoot
- heavy
- soft
- continuous

### Loop

Does the motion repeat?

If yes, identify whether it is:

- time-driven
- pointer-driven
- scroll-driven
- state-driven

## Phase 6: Technical Assessment

Identify the simplest plausible technology for the observed behavior.

Apply the visual stability and UI refactoring rules from `references/ui-rules.md`.

Additional reference-analysis options may include:

### Image Layers

Appropriate for:

- art-directed visual scenes
- pointer parallax
- foreground and background depth
- fixed lighting baked into renders

### Image Sequence

Appropriate for:

- controlled pseudo-3D rotation
- scroll-driven product rotation
- highly art-directed rendered objects

Recommend WebGL only when the observed behavior or requested implementation scope needs it.

## Phase 7: Separate Observation From Source Evidence

When implementation source, prompts, or code are available, distinguish them from visual inference.

Use labels such as:

    OBSERVED
    SOURCE-CONFIRMED
    INFERRED

Example:

    OBSERVED:
    The center object tilts with the pointer.

    SOURCE-CONFIRMED:
    The Soda implementation updates modelViewer.cameraOrbit from normalized pointer coordinates.

    LUMINAL ADAPTATION:
    Use slower pointer interpolation and a smaller orbit range.

This distinction is required when making technical recommendations.

## Phase 8: Luminal Adaptation

Every analysis must include a Luminal adaptation.

Use this structure:

    REFERENCE BEHAVIOR

    WHY IT WORKS

    DO NOT COPY

    LUMINAL ADAPTATION

Example:

    REFERENCE BEHAVIOR

    Soda repeats one cherry GLB across foreground and background layers.

    WHY IT WORKS

    Reusing one asset creates visual density without requiring many unique models.

    DO NOT COPY

    Fruit, bright colors, energetic bounce, strong pointer repulsion.

    LUMINAL ADAPTATION

    Reuse one optimized crystal fragment GLB at multiple scales and orientations.
    Use slow inverse parallax and low-strength magnetic avoidance.
    Let fragments settle gradually after pointer movement.

## Phase 9: Motion Budget Check

Before recommending a motion pattern, compare it against Luminal's motion budget.

Per viewport:

- one primary motion
- maximum two secondary motions

Classify each recommended motion.

Example:

    Primary:
    central hero 3D scene

    Secondary:
    typography assembly

    Secondary:
    magnetic crystal drift

If the reference would exceed the budget, remove or simplify effects.

## Phase 10: Performance Assessment

For motion or 3D references, identify likely performance costs.

Consider:

- number of 3D objects
- repeated GLB loading
- number of render loops
- shaders
- large image sequences
- texture size
- device pixel ratio
- pointer listeners
- continuous animation
- mobile GPU cost

Recommend a fallback where appropriate.

Possible fallbacks:

- fewer object instances
- static render
- automatic slow rotation
- reduced pointer interaction
- reduced-motion mode
- mobile-only image
- lower-resolution textures

## Research Artifact

When the user asks to formally record the analysis, create a reference note under:

    docs/research/references/

Use the file name:

    <reference-name>.md

Example:

    docs/research/references/getlayers-soda.md

Use this structure:

    # Reference Name

    ## Scope

    ## Why This Reference Matters

    ## Observed Experience

    ## Interaction Model

    ## Spatial Layers

    ## Motion Breakdown

    ## Technical Assessment

    ## Source-Confirmed Details

    ## What Must Not Be Copied

    ## Luminal Adaptation

    ## Performance Considerations

    ## Applicable Luminal Pages

Create research files only for durable reference decisions.

Create one when:

- the reference materially affects the project direction
- the behavior will likely be implemented
- the user explicitly asks to document it
- the reference should become durable Codex context

## Implementation Rule

Reference analysis records observations and adaptations. Implementation still requires user-approved scope and the relevant repository-owned guidance.

Before implementing from a reference:

1. the user-requested implementation scope must be clear
2. relevant ERP guidance owners must be read
3. any product behavior, UI appearance, workflow storage, database shape, or cross-module architecture change must be explicitly requested or authorized by repository-owned guidance

Small brownfield fixes and refactors continue to follow the repository's incremental process.

## What Not to Do

Keep the analysis adapted to Luminal:

- describe behavior before implementation
- distinguish observation, source-confirmed evidence, and inference
- adapt principles instead of copying branding, copy, proprietary assets, complete layouts, or design tokens
- recommend libraries only when they fit the requested implementation scope
- compare motion recommendations against the motion budget
- keep ERP product, UI, data, workflow, and architecture rules authoritative

## Completion

When completing a reference analysis, report:

1. what was studied
2. the important observed behaviors
3. source-confirmed technical details, when available
4. the most useful principle
5. what should not be copied
6. the recommended Luminal adaptation
7. likely performance considerations
8. which Luminal page or feature the reference applies to
