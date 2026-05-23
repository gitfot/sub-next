# Homepage Left Config Redesign Design

Date: 2026-05-23
Repository: `sub-next`
Status: Ready for review

## Summary

This design refactors the homepage left configuration panel so dataset selection and manual input are clearly separated.

The current homepage mixes selected dataset content directly into the two editable textareas. That makes the UI hard to understand, makes unchecking fragile, and forces one field to carry three jobs at once: source selection result, manual input, and deletion target.

The redesign replaces that behavior with expandable dataset cards plus independent manual input areas:

- dataset sources are selected through cards with checkbox state and inline preview
- manual input remains editable only inside its own textarea
- dataset content is no longer copied into the textarea
- final request payloads are still assembled from selected dataset ids plus manual input at preview and publish time

## Goals

- Remove the current "append dataset content into textarea" behavior for both source groups.
- Let the user preview dataset content on the homepage before deciding whether to select it.
- Keep the homepage layout height stable and use internal scrolling for overflow.
- Make checkbox state, preview state, and manual input state independent and easy to reason about.
- Preserve the current backend contract for preview and publish requests.

## Non-Goals

- Do not redesign the right-side result panel in this change.
- Do not change dataset CRUD flows in the data management pages.
- Do not add inline editing of dataset content on the homepage.
- Do not change generator or subscription API schema shape.
- Do not introduce drag-and-drop, search, or dataset grouping unless needed later.

## Current State

The homepage currently renders two source checkbox lists and two editable textareas in [apps/web/src/routes/home-page.tsx](/mnt/d/wanwan/project/self/proxy/sub-next/apps/web/src/routes/home-page.tsx).

When the user checks a dataset:

- the dataset id is added to `nodeLinkSetIds` or `preferredAddressSetIds`
- the dataset content is merged into `nodeLinksInput` or `preferredAddressesInput`
- duplicate lines are deduplicated through line-level merging helpers

When the user unchecks a dataset:

- the code tries to reconstruct "manual input" by removing lines associated with unselected datasets

This creates several product and code problems:

- the textarea no longer tells the user which lines came from which source
- unchecking is line-based and therefore indirect and hard to trust
- manual input and selected dataset content cannot be managed independently
- state helpers become more complex than the real feature needs

## User Experience Design

## Left Panel Structure

The left panel remains the same high-level column, but each source section becomes more explicit.

Target order:

1. `节点链接来源`
2. `自定义节点链接`
3. `优选地址来源`
4. `自定义优选地址`
5. existing prefix and host/SNI controls
6. existing generate button

Both source sections use the same card pattern.

## Dataset Card Pattern

Each dataset is rendered as one expandable card with:

- checkbox
- dataset name
- item count derived from non-empty trimmed lines in dataset content
- expand/collapse affordance
- optional preview body

The card supports two distinct actions:

- clicking the checkbox toggles selected state only
- clicking the dedicated expand button in the card header toggles preview only

Selected state and expanded state must stay independent.

Visual expectations:

- selected cards receive a stronger border and tinted background
- the dataset name and count gain selected emphasis
- the preview body is visually nested inside the card
- preview content uses the existing monospace treatment already used by textarea content

## Preview Behavior

The homepage must support lightweight inspection before selection.

Preview rules:

- each card may be expanded or collapsed independently
- preview content shows the first 4 non-empty trimmed lines from the dataset content
- if more lines exist than the preview limit, show a trailing summary such as `还有 N 条...`
- preview areas have a max height and scroll internally when needed

The goal is quick confidence, not full dataset management.

## Manual Input Areas

Each source group keeps a dedicated manual input area directly below the dataset card list.

Rules:

- the textarea stores only manual input entered by the user
- selected dataset content is never copied into the textarea
- clearing or editing the textarea only affects manual input
- checking or unchecking cards does not mutate textarea value

Optional collapsible behavior may be kept if implementation cost is low, but the textarea should remain expanded by default.

## Layout and Scrolling

The homepage keeps the current two-panel layout.

Scrolling behavior:

- the overall page height remains stable
- the left panel scrolls internally if content exceeds the available height
- dataset lists may also have their own max height and internal scrolling if needed
- preview bodies have their own max height to prevent one expanded dataset from dominating the panel

This allows the homepage to support many datasets without making the whole page grow indefinitely.

## Interaction Details

## Selection

When the user selects a dataset:

- only the corresponding selected id list changes
- the card enters selected styling
- existing generated nodes and warnings are cleared as they are today
- the current public subscription URL is cleared as it is today

When the user unselects a dataset:

- only the corresponding selected id list changes
- no textarea content is removed because none was injected there
- existing generated nodes and warnings are cleared as they are today
- the current public subscription URL is cleared as it is today

## Expansion

Expanded state is UI-only local state. It does not need to be persisted to the saved draft.

Recommended behavior:

- maintain one expanded id set for node-link datasets
- maintain one expanded id set for preferred-address datasets
- allow multiple cards to stay expanded at once

This is better for comparison than an accordion that forces only one card open.

## Draft Persistence

Saved draft behavior should remain stable for meaningful inputs:

- persist selected dataset ids
- persist manual textarea values
- persist prefix, host/SNI checkbox, preview nodes, warnings, subscription type, remark, and regenerate flag

Do not persist:

- expanded card state

The existing `home-draft` storage model already supports selected ids and manual textarea values, so this change should mostly remove coupling rather than add new persistence fields.

## State Design

## Keep

Keep these state concepts:

- `nodeLinkSetIds`
- `preferredAddressSetIds`
- `nodeLinksInput`
- `preferredAddressesInput`
- `namePrefix`
- `keepOriginalHost`
- generated nodes, warnings, result modal state, and publish fields

## Remove

Remove the behavior dependency between:

- dataset selection and textarea mutation

That means the homepage no longer needs helper functions whose only purpose is to merge or subtract dataset lines from textarea content.

Helpers expected to become removable:

- line splitting and unique section merge helpers used only for textarea synthesis
- removal logic that tries to reconstruct manual input from a mixed textarea

## Add

Add local UI state for expansion only:

- `expandedNodeDatasetIds`
- `expandedPreferredDatasetIds`

These are presentational state values and should not affect request payload shape.

## Request Assembly

Preview and publish request assembly stays conceptually the same:

- send selected node dataset ids, if any
- send selected preferred-address dataset ids, if any
- send manual `nodeLinksInput`
- send manual `preferredAddressesInput`

Important rule:

- request-time combination replaces edit-time combination

In other words, the API still receives both ids and manual text, but the homepage no longer materializes a merged textarea to get there.

## Rendering and Component Boundaries

This redesign is small enough to stay within the existing homepage route, but the dataset card UI should be factored for clarity.

Preferred frontend split:

- keep `HomePage` responsible for data fetching, draft restoration, preview/publish actions, and top-level form state
- extract a small reusable dataset-card-list component or local subcomponent for the repeated source card UI

The source card UI for node links and preferred addresses follows the same structure. Reusing one component will reduce duplication and make styling changes safer.

Suggested subcomponent responsibilities:

- render dataset cards
- render checkbox state
- render expand/collapse state
- render preview lines and remaining count
- emit `onToggleSelected(id, checked)` and `onToggleExpanded(id)`

The parent route remains responsible for request payloads and saved draft state.

## Error Handling and Empty States

If dataset loading fails:

- keep the current fallback behavior of showing no selectable datasets
- still allow manual textarea input and generation attempts

If a source group has no datasets:

- show a muted empty-state message like today
- still show the manual input area below it

If dataset content is long or malformed:

- preview rendering should stay plain-text and line-based
- do not parse or validate on the client beyond simple line splitting for preview display

## Accessibility

Minimum accessibility expectations:

- cards remain keyboard-usable through native checkbox controls and focusable expand buttons
- expand/collapse controls expose `aria-expanded`
- expand buttons expose an accessible name that includes the dataset name
- each source list keeps an accessible label
- selected styling is not the only selection indicator; the checkbox remains the primary state signal

Avoid making the full card clickable if that blurs the distinction between selection and preview actions.

## Testing Design

Update homepage tests to reflect the new model.

Tests to add or revise:

- selecting node-link datasets does not append dataset content into the node-link textarea
- unselecting node-link datasets does not remove manual textarea content
- selecting preferred-address datasets does not append dataset content into the preferred-address textarea
- expanded previews show dataset snippets without affecting selected state
- restoring a draft still restores selected ids and manual textarea values correctly
- preview and publish calls still send selected dataset ids plus manual textarea values

Existing tests that assert merged textarea content after checkbox selection should be replaced with assertions that the textarea remains manual-only.

## Implementation Notes

Expected files in scope:

- [apps/web/src/routes/home-page.tsx](/mnt/d/wanwan/project/self/proxy/sub-next/apps/web/src/routes/home-page.tsx)
- [apps/web/src/styles.css](/mnt/d/wanwan/project/self/proxy/sub-next/apps/web/src/styles.css)
- [apps/web/src/routes/__tests__/home-page.test.tsx](/mnt/d/wanwan/project/self/proxy/sub-next/apps/web/src/routes/__tests__/home-page.test.tsx)

Possible light-touch scope:

- [apps/web/src/app/home-draft.ts](/mnt/d/wanwan/project/self/proxy/sub-next/apps/web/src/app/home-draft.ts) only if cleanup is needed after removing old coupling assumptions

No API or schema changes are required unless implementation uncovers a mismatch between current request assembly and the documented behavior.

## Risks and Trade-Offs

- More visual structure means more CSS and a slightly denser left panel, but this is the intended trade for clarity.
- Allowing multiple expanded cards can make the panel tall, so max-height and internal scroll constraints are important.
- Showing preview snippets creates repeated UI for two source groups, so extracting shared rendering logic is preferred.

These trade-offs are acceptable because the redesign primarily solves correctness and usability problems in the current flow.

## Acceptance Criteria

- Checking and unchecking source datasets never mutates the corresponding manual textarea values.
- Users can preview dataset content on the homepage before choosing whether to select it.
- The left panel remains usable with many datasets because overflow is handled through internal scrolling.
- Preview and publish still work using selected dataset ids plus manual textarea input.
- Homepage draft restore still restores selected ids and manual input correctly.
