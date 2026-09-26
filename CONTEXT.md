# Workouts

Workouts helps a person relate training and nutrition. This glossary names the domain concepts shared by those experiences.

## Training

**Activity**:
The umbrella term for one instance of physical movement performed over a duration, such as a Strength Session, run, ride, or scored WOD performance.
_Avoid_: Workout or Session as the umbrella term

**Strength Session**:
An Activity in which a person performs Exercises as Sets. A Strength Session may be free-form or started from a Routine.
_Avoid_: Workout Session

**Exercise**:
A named strength movement that can be performed in Sets.

**Shipped Exercise**:
A read-only Exercise included with the app and available to everyone.

**Personal Exercise**:
An Exercise created by a person for their own training.

**Set**:
One recorded performance of an Exercise, including its repetitions, load, and optional effort or set classification.

**Routine**:
A reusable sequence of Exercises with suggested Sets, repetitions, and loads for starting a Strength Session.
_Avoid_: Program, template

**WOD**:
A reusable workout prescription with a scoring format and one or more movements.
_Avoid_: WOD result, score

**WOD Result**:
A person's scored performance of a WOD on a particular date, optionally as part of a Strength Session.
_Avoid_: WOD

**One-rep Max**:
The greatest known or estimated load a person can lift once for an Exercise.

**Personal Record**:
A person's best comparable performance. One-rep Maxes and best WOD Results are different kinds of Personal Record.
_Avoid_: PR in formal domain language

**Body Metric**:
A dated measurement of a person's body, such as weight, body-fat percentage, or circumference.

**Hosted Workout**:
A host-owned shared event with a frozen workout prescription, participant list, and leaderboard. It is not the host's or a participant's personal training history.

**Participant**:
A signed-in person who joins a Hosted Workout and records the resulting training in their own history.

**Submission**:
A score contributed to a Hosted Workout leaderboard. A Participant's Submission may correspond to a personal WOD Result; a guest Submission does not create personal history.

## Nutrition

**Nutrition**:
The domain for recording and reviewing food intake, including the Nutrition Diary, Food Library, Personal Library, Nutrition Goals, Recipes, and Capture Drafts. Nutrition is separate from Activity.
_Avoid_: Meal Activity

**Food**:
A named edible item with nutrition figures that can be logged in the Nutrition Diary.

**Food Library**:
All Foods available for ordinary search without consulting an external food database: Shipped Foods and Personal Foods.
_Avoid_: Local foods, Personal Library

**Personal Library**:
A person's reusable Personal Foods and Combos.
_Avoid_: Food Library

**Shipped Food**:
A read-only Food included with the app.
_Avoid_: Standard food, built-in food

**Personal Food**:
A reusable Food saved by a person, whether entered manually, imported, or forked from a Shipped Food.
_Avoid_: Custom food

**Food Visual**:
An optional icon or photo owned by a Personal Food to help a person recognize it. It is separate from Food Provenance; when unset, the interface supplies a default fallback.
_Avoid_: Food image, provenance image

**Food Import**:
A proposal created from an external food database that must be reviewed before it can become a Personal Food or Diary Entry.
_Avoid_: Synced food, downloaded food

**Food Provenance**:
The recorded origin of nutrition figures, such as a Shipped Food, Personal Food, or Food Import. Provenance explains where figures came from without making the source necessary for reading history.
_Avoid_: Source food

**Nutrition Diary**:
A person's record of food intake, organized by date and Meal Slot.
_Avoid_: Food Library

**Diary Entry**:
A snapshot of a chosen amount and its nutrition figures logged at a particular time. Later changes to its Food, Serving, or Personal Measure never alter the entry.
_Avoid_: Food log

**Meal Slot**:
A named part of a day used to organize Diary Entries: breakfast, lunch, dinner, or snacks. It is not a reusable collection of Foods.
_Avoid_: Combo

**One-off Entry**:
A Diary Entry created directly without adding a reusable Food to the Personal Library.
_Avoid_: Personal Food

**Food Reference**:
An optional link from a Diary Entry or Combo part to its source Food. Historical snapshots remain valid when the referenced Food is unavailable or deleted.

**Unavailable Food**:
A Food Reference whose source cannot be found in the current Food Library. Existing snapshots remain readable, but source-dependent actions are unavailable.

**Nutrition Goal**:
An effective-dated minimum or maximum amount for a nutrient over a day. Historical dates retain the goals that applied to them.
_Avoid_: Nutrient Target, Goal

**Nutrient Value**:
A nutrient's recorded state: a measured amount, a trace amount, or no available figure. No available figure is not the same as zero.

**Nutrition Estimate**:
An explicitly approximate set of nutrition figures proposed by a person or AI. Estimation is independent of a Food's category and provenance, and remains attached to any Diary Entry created from it.
_Avoid_: Recipe, manually entered Food

**Serving**:
A named amount of a Food, such as one banana or one slice. A Food may offer several Servings.
_Avoid_: Portion, serving size

**Personal Measure**:
A person-defined, account-synced exact amount in grams or millilitres with a name, reusable when logging a Food with the same base unit. It supplements rather than replaces a Food's Servings.
_Avoid_: Portion, custom Serving

**Combo**:
A named reusable ordered collection of Foods and One-off Entries that are logged together. Future logs use current figures from referenced Foods, while the resulting Diary Entries remain frozen snapshots.
_Avoid_: Meal, Routine, preset

**Logged Combo**:
A named group of Diary Entries representing one occurrence of a Combo in the Nutrition Diary. Its entries remain frozen snapshots even when the reusable Combo later changes or becomes unavailable.
_Avoid_: Combo when distinguishing diary history from the reusable definition

**Combo Scale**:
A temporary multiplier used while logging a Combo. A whole-Combo scale combines multiplicatively with each included part's scale without changing the reusable Combo.
_Avoid_: Serving, saved quantity

**Recipe**:
A Personal Food categorized as a prepared dish so it can be found and logged as such. Recipe is a classification, not a separate record type or a claim about the precision of its nutrition figures.
_Avoid_: Combo, Recipe Version

**Capture Draft**:
A note about food intake, placed in the Nutrition Diary under its date and Meal Slot, saved for later review. It does not count as intake until converted into one or more Diary Entries.
_Avoid_: Diary Entry, unfinished log

**Shipped Food ID**:
The permanent identity of a Shipped Food. It never changes or gets reused, even when the Food is renamed, corrected, or retired.
_Avoid_: seed key, slug, food key

**Fork**:
The Personal Food created when a person corrects a Shipped Food. Correcting a Shipped Food never changes the original.
_Avoid_: Copy, override, custom version

**Shadowing**:
The rule that a Shipped Food is hidden from ordinary search while a Fork of it exists. Removing the Fork restores the Shipped Food.
_Avoid_: Overriding, hiding, superseding

**Retired Shipped Food**:
A Shipped Food withdrawn from search while retaining its permanent identity and existing references.
_Avoid_: Deleted food, archived food
