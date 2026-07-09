---
name: reference-analysis
description: Analyze one or more websites as design, motion, interaction, commerce, or engineering references for Luminal Factory. Extract useful patterns, document behavior, identify technical approaches, and propose Luminal-specific adaptations. Never clone branding, content, assets, or complete layouts literally.
argument-hint: "<url1> [<url2> ...]"
user-invocable: true
---

# Website Reference Analysis

Analyze one or more websites provided in `$ARGUMENTS` as references for Luminal Factory.

This skill is for research and adaptation.

It is not a pixel-perfect cloning workflow.

The objective is to understand:

- what the reference does
- how the experience behaves
- why the behavior works
- which technical approach may be involved
- what is useful for Luminal Factory
- what must not be copied
- how the concept should be adapted to Luminal's identity

Use the full workflow when the reference may affect project direction, a page specification, a motion system, commerce structure, or implementation planning.

For a quick scan, identify only the requested scope, observed behavior, useful principle, what should not be copied, and Luminal adaptation.

## Core Rule

Never treat a reference website as the final design authority.

Luminal Factory's project context, commerce model, design rules, and approved page scripts are authoritative.

A reference may contribute:

- interaction logic
- motion architecture
- layout principle
- information hierarchy
- technical pattern
- component behavior
- spatial composition
- commerce structure

A reference must not automatically contribute:

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

Before analyzing a reference for implementation use, consult the Luminal commerce skill.

Relevant project guidance lives in:

    .agents/skills/luminal-commerce/

At minimum, consider:

    references/project-context.md
    references/ui-rules.md
    references/workflow.md

For commerce references, also consult:

    references/commerce-domain.md

For architectural references, also consult:

    references/architecture.md

Authority order is owned by `AGENTS.md`. Visual and motion rules are owned by `references/ui-rules.md`. Commerce meaning is owned by `references/commerce-domain.md`.

## Analysis Modes

Determine the most relevant analysis mode from the user's request.

Possible modes include:

- visual
- motion
- interaction
- 3D
- layout
- commerce
- content structure
- engineering architecture
- component behavior

A reference may use multiple modes.

Do not perform unrelated analysis merely because the website contains additional features.

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
    -> Luminal Home Hero

    Artkey catalogue
    -> commerce structure
    -> Luminal Archive

    Aixor project sections
    -> editorial composition
    -> Luminal Home and Factory pages

Do not analyze an entire site when the user only references one interaction.

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

Do not describe a behavior merely as "animated".

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

Apply the Luminal animation technology hierarchy from `references/ui-rules.md`.

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

Do not recommend WebGL merely because a scene looks visually rich.

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

Do not create a research file automatically for every casual reference.

Create one when:

- the reference materially affects the project direction
- the behavior will likely be implemented
- the user explicitly asks to document it
- the reference should become durable Codex context

## Implementation Rule

Reference analysis does not grant permission to implement a page.

Before implementing a major Luminal page or experience:

1. the page script must be approved
2. the specification must exist
3. the technical plan must exist
4. implementation scope must be clear

Do not turn a reference analysis directly into a finished page unless the user explicitly changes the project workflow.

## What Not to Do

Do not:

- create a pixel-perfect clone by default
- copy branding
- copy product names
- copy page text
- copy proprietary imagery
- download reference assets for final Luminal production use
- copy a complete page layout without adaptation
- treat extracted CSS values as Luminal design tokens
- install every library detected in a reference
- assume visual similarity proves identical technical implementation
- add reference effects without checking the motion budget
- implement an unapproved page directly from a reference
- override Luminal commerce rules because another brand uses a different model

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
