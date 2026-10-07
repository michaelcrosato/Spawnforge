# Examples

Every blueprint here sits beside its render (`<name>.json` and `<name>.png`), so people and LLMs
can see what a blueprint produces. They double as the golden test set: each must stay valid, and
once the pipeline lands each must compile to the same quantized mesh and skeleton on every run.

Regenerate the renders with `pnpm render:examples` after changing a blueprint or the pipeline.
Winged examples render folded, as they rest; `pnpm spawnforge render <file> --pose spread` shows
their wings open.

| Blueprint                                      | Body plan | Shows                                              |
| ---------------------------------------------- | --------- | -------------------------------------------------- |
| [ridgeback-stalker.json](ridgeback-stalker.json) | Quadruped | Profiles, mirrored limbs, horns, spike row, eyes, a three-layer skin |
| [bog-troll.json](bog-troll.json) | Biped | Upright torso, long arms with grasping hands, tusks, teeth, mottle and grime |
| [ember-beetle.json](ember-beetle.json) | Hexapod | Sprawled legs, a nose horn, chitin, spots on the back, overriding preset eyes |
| [reed-viper.json](reed-viper.json) | Serpent | No legs, fangs, banded back over scales; slithers into water and swims with its head out |
| [grey-wolf.json](grey-wolf.json) | Quadruped | Padded paws on a digitigrade stance (feet that roll as they walk), a bushy tail, mottled coat |
| [tusk-boar.json](tusk-boar.json) | Quadruped | Cloven hooves (unguligrade), tusks from the jaw, a bristle row, grime |
| [rust-raptor.json](rust-raptor.json) | Biped | Taloned feet with three toes forward and one back, a long tail, striped scales; walks, then runs with both feet off the ground each stride |
| [terror-bird.json](terror-bird.json) | Biped | A hooked beak in two halves, a heavy brow and squinting lidded eyes, an S-curved neck, talons |
| [hydra.json](hydra.json) | Quadruped | Five heads on long S-curved necks, each with its own mouth, slit-pupilled eyes and teeth; a spine crest; scales |
| [cerberus.json](cerberus.json) | Quadruped | Three wolf-sized heads fanned wide, ears and long fangs copied onto each, fur |
| [two-tailed-fox.json](two-tailed-fox.json) | Quadruped | Two raised tails, each its own spring; paws, fur and a pale belly |
| [tomb-spider.json](tomb-spider.json) | Octopod | Eight arched legs (longest in front) that walk in a wave and run in alternating fours; fangs that open with the bite; stripes and spots on chitin |
| [grove-centaur.json](grove-centaur.json) | Centaur | An upright human torso with shoulders, a chest and hands; hooves, horns and pointed ears; hide |
| [ash-dragon.json](ash-dragon.json) | Quadruped | Leathery four-fingered wings on the shoulders, folded along the flanks at rest; veins on the wings, horns, a spine crest |
| [cave-bat.json](cave-bat.json) | Wyvern | Five-fingered wings whose membrane trails to the legs, a thumb claw, big ears and fur |
| [storm-wyvern.json](storm-wyvern.json) | Wyvern | Wings for forelimbs trailing to the body, a band across the wings, pale horns, a spined tail |
| [rhino-beetle.json](rhino-beetle.json) | Hexapod | Hard wing cases over the abdomen, with the hind wings folded away beneath them; a nose horn; chitin |
| [luna-moth.json](luna-moth.json) | Hexapod | Broad fore and round hind wings, see-through and veined, with ringed eye spots (a `wings` layer); feathery antennae on springs; fur |
| [reef-shark.json](reef-shark.json) | Fish | Rayed pectoral fins, flat pelvic fins, a falcate dorsal fin and a forked tail fin; teeth; swims at 1 m/s, diving to the depth asked for |
| [griffin.json](griffin.json) | Quadruped | Feathered wings (fingered primaries) folded in rows along the body, a hooked beak, talons in front and paws behind, fur |
| [kraken.json](kraken.json) | Serpent | Eight arms and two long clubbed feeding tentacles ringing the head, curling onto the ground; suckers beneath; big slit-pupilled eyes; `bite` reaches the tentacles, `lash` whips one; swims as well as slithering |
| [dune-scorpion.json](dune-scorpion.json) | Octopod | Pincers held forward on arms that `pinch` one claw at a time, a tail curled over the back with a stinger that `lash`es; banded chitin |
| [stone-tortoise.json](stone-tortoise.json) | Quadruped | A high domed shell with scutes and a flared rim over a wide body, column feet |
| [plated-stegosaur.json](plated-stegosaur.json) | Quadruped | Two staggered rows of kite plates edged in red, a spiked tail, high hips |
| [porcupine.json](porcupine.json) | Quadruped | Quills scattered over the back, tipped dark, that rise in `display`; fur and paws |
| [frilled-lizard.json](frilled-lizard.json) | Quadruped | A frill folded over the neck that opens into a disc in `display`; a banded tail |
| [hooded-cobra.json](hooded-cobra.json) | Serpent | A rearing neck whose hood spreads in `display`, with eye marks on its back |
| [sail-back.json](sail-back.json) | Quadruped | A tall sail on spines along the back that stands up in `display`; teeth, stripes |
| [wild-horse.json](wild-horse.json) | Quadruped | Long legs on single hooves that walk, trot and gallop (transverse, leading right) up to 12 m/s; a mane row, short fur |
| [sand-cheetah.json](sand-cheetah.json) | Quadruped | A slender body on long legs that gallops rotary, footfalls going round the body, the back flexing; spots on fur |
| [river-crocodile.json](river-crocodile.json) | Quadruped | A wide, low body on sprawled legs, a long wedge snout and a tall tail with scutes; walks into water, swims with its back awash and climbs out |
| [sea-turtle.json](sea-turtle.json) | Quadruped, legs removed | Flippers (fin limbs with no membrane) that beat as it swims, a domed shell with scutes, a hooked beak; stops at the shore |
