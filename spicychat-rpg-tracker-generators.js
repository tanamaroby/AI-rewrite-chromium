(function () {
  "use strict";

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const NPC_FIRST_NAMES = [
    "Aelric", "Branwen", "Corvin", "Dessa", "Elara", "Finnick", "Ghislaine",
    "Halvard", "Iselin", "Joren", "Kessia", "Leofric", "Maren", "Nyssa",
    "Orin", "Perrin", "Quintara", "Rosalind", "Soren", "Talia", "Ulric",
    "Vesna", "Wrenna", "Yorick", "Zephra", "Cassian", "Dorotea", "Eamon",
    "Fenna", "Garrick",
  ];

  const NPC_SURNAMES = [
    "Ashgate", "Blackmoor", "Duskwhisper", "Emberfall", "Foxglove",
    "Graywick", "Hollowmere", "Ironvale", "Larkspur", "Moonhollow",
    "Nightshade", "Oakhart", "Ravensworth", "Silverbrook", "Thornfield",
    "Underhill", "Vaelstrom", "Whitlock", "Wynmoor", "Cinderfell",
  ];

  const NPC_EPITHETS = [
    "the Wary", "the Quiet", "the Bold", "the Cunning", "the Unlucky",
    "the Wanderer", "the Merchant", "the Exile", "the Gambler",
    "the Faithful", "the Scarred", "the Hollow", "the Nameless",
  ];

  const NPC_TRAITS = [
    "Sells rare goods and never haggles down",
    "Distrusts outsiders but warms up quickly to kindness",
    "Owes a debt they won't talk about",
    "Knows everyone's business in town",
    "Carries an old weapon they claim was a gift",
    "Speaks in riddles when nervous",
    "Recently lost someone close and hides the grief",
    "Collects strange trinkets from travelers",
    "Has a secret they'd do almost anything to protect",
    "Fiercely loyal once trust is earned",
    "Superstitious about bad omens",
    "Quick with a joke to defuse tension",
    "Watches newcomers a little too closely",
    "Used to be someone important, before",
    "Offers help, but always expects something in return",
  ];

  const QUEST_OBJECTS = [
    "a sealed letter", "an heirloom blade", "a stolen ledger",
    "a missing shipment", "an ancient relic", "a forged signature",
    "a vial of rare poison", "a locked chest", "a family portrait",
    "a set of stolen keys",
  ];

  const QUEST_LOCATIONS = [
    "the old harbor district", "an abandoned watchtower",
    "the merchant's quarter", "a smugglers' den beneath the tavern",
    "the ruins outside town", "a noble's private estate",
    "the underground archive", "a fog-bound crossroads",
    "the back rooms of the guildhall", "a caravan camp on the road",
  ];

  const QUEST_FACTIONS = [
    "the city guard", "a rival merchant house", "a secretive cult",
    "the local thieves' guild", "a band of mercenaries",
    "an exiled noble family", "a traveling caravan of traders",
    "the temple's inner circle",
  ];

  const QUEST_ROLES = [
    "a frightened informant", "an injured courier", "a runaway apprentice",
    "a reluctant witness", "a disgraced noble", "a wandering scholar",
  ];

  const QUEST_TEMPLATES = [
    () =>
      `Retrieve ${pick(QUEST_OBJECTS)} from ${pick(QUEST_LOCATIONS)} before ${pick(QUEST_FACTIONS)} gets there first.`,
    () =>
      `Investigate strange disappearances near ${pick(QUEST_LOCATIONS)}.`,
    () =>
      `Escort ${pick(QUEST_ROLES)} safely through ${pick(QUEST_LOCATIONS)}.`,
    () =>
      `Uncover who is smuggling ${pick(QUEST_OBJECTS)} through ${pick(QUEST_LOCATIONS)}.`,
    () =>
      `Broker a truce between ${pick(QUEST_FACTIONS)} and ${pick(QUEST_FACTIONS)} before it turns to bloodshed.`,
    () =>
      `Track down ${pick(QUEST_OBJECTS)} that vanished from ${pick(QUEST_LOCATIONS)}.`,
    () =>
      `Root out an informant working for ${pick(QUEST_FACTIONS)} inside ${pick(QUEST_LOCATIONS)}.`,
  ];

  const QUEST_TWISTS = [
    "Twist: the one who hired you is the real culprit.",
    "Twist: the target isn't what it seems.",
    "Twist: an old ally stands on the other side this time.",
    "Twist: the trail leads somewhere far more dangerous than expected.",
    "Twist: someone else is already hunting the same lead.",
    "Twist: the reward comes with strings no one mentioned.",
    "Twist: the truth would hurt more than the lie.",
    "",
    "",
  ];

  function randomNpcName() {
    const name = `${pick(NPC_FIRST_NAMES)} ${pick(NPC_SURNAMES)}`;
    return Math.random() < 0.25 ? `${name} ${pick(NPC_EPITHETS)}` : name;
  }

  function randomNpcTrait() {
    return pick(NPC_TRAITS);
  }

  function randomQuestHook() {
    const title = pick(QUEST_TEMPLATES)();
    const notes = pick(QUEST_TWISTS);
    return { title, notes };
  }

  window.SCRPGTrackerGenerators = {
    randomNpcName,
    randomNpcTrait,
    randomQuestHook,
  };
})();
