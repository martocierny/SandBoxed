# SandBoxed

A 2D multiplayer sandbox in the browser, where players build the world by describing objects
in plain words and the AI on their computer turns those words into objects.

**Live demo:** https://sandboxed.martocierny.workers.dev/

## The idea

 A player either hosts a new sandbox or joins an existing one.
 A sandbox is a shared 2D world with its own rules.
 To add something, a player describes it: "a bomb that explodes when touched",
  "a bird that flies around".
 The player's own AI turns the words into an object script: its look and its behavior.
  It runs locally – Chrome's built-in AI, a model inside the browser, or the player's own AI server.
 The script is sent to the other players. Their computers check it automatically against the
  sandbox rules – no people involved. A valid object is accepted and comes to life; anything broken
  or unsafe is rejected.
 The AI never runs code. An object is plain JSON made of ready-made parts, so every player's computer
  can check it the same way, no matter which AI created it.

## Goals

 Creativity over grinding: anything you can describe can become part of the world.
 Local AI first: no AI costs for the game and no prompts sent to a company server.
  Players choose the AI they want.
 Decentralized: players talk to each other directly (peer-to-peer). The server only helps them
  find each other.
 Safe by design: objects are data, not code, and every player validates every object.
 Code: plain HTML, CSS and JavaScript (ES modules), no build step and no framework.

## Status

### Works today
 AI choice with a check, download and delete of the model:
   Chrome AI – the model built into Chrome (Prompt API),
   Browser model – runs in the browser with WebLLM and WebGPU (Small / Medium / Large),
   AI server – Ollama, LM Studio or any OpenAI-compatible server.

 Hosting a sandbox on your own computer: name, player count (2–8), who can join, gravity,
  what objects may destroy.
 The world: seen from the side, with ground, sky and gravity. It is much wider than the screen;
  drag the empty space or use the mouse wheel to look around. Click an object to select, copy or delete it.
 Workbench: describe an object → see a preview and its editable script → put it into the sandbox.
 Looks: an icon (Twemoji), an AI sketch (Sketch-RNN), shapes, or your own drawing.
 Behavior: movement, effects, particles and reactions (explode, shoot, spawn…), with safety limits.
 Validation of every object script.

### Not built yet
 Multiplayer – the core of the game. Join is not there yet. Missing pieces: the signaling server,
  WebRTC connections between players, syncing the world, validation by the other players,
  and host migration.
 Better looks: a test set comparing models, emoji as parts, a fixed color palette, part groups.
 Later: accounts, saving objects, private objects, rules that players can change.

## Roadmap

1. Multiplayer
    Signaling server – candidate: Cloudflare Workers + Durable Objects. Lists sandboxes and helps
     browsers connect.
    Peer-to-peer connections with WebRTC.
    One host is the authority for the simulation and the state of the world.
    Host migration: the host keeps sending snapshots of the world to a few candidates, ranked by
     latency, performance, connection stability and time connected. If the host leaves, the first
     candidate takes over and the game goes on.
    Distributed validation: every player checks every new object with the same rules.
2. Looks
    A test set: the same prompts on different models, results side by side.
    Emoji as parts of a look, a fixed palette for the AI.
    Later: part groups (e.g. a spinning wheel), checking the result with an image, SVG.
3. Later
    Accounts and saving objects.
    Public / private objects – every object has an author. A private object cannot be saved or
     copied by others. For now everything is public.
    Sandbox rules that players can change.
    Remote AI (your own API key, or an AI hosted by someone else).

## Get involved

contact me on discord @martocierny or mail: satoshi-nakamoto@keemail.me

Tell me – new features, a different approach, criticism of the design, all welcome.

Help is especially welcome with:

 Networking: WebRTC, the signaling server, world sync, host migration.
 AI and prompts: reliable results from small local models, comparing models.
 Game feel: looks, effects, physics, the 2D canvas.
 Security: validation rules, finding ways to break them.
 Testing: different computers, GPUs and browsers.

It's a hobby : no deadlines, contribute as much or as little as you like.

Fork the repository and create a branch.
Keep it simple: plain HTML/CSS/JS, no build step, no framework. Libraries only if they are optional
and loaded when a player needs them.
Open a pull request with a short description of what it does.

## Run it locally

ES modules don't work when you open the file directly (`file://`), so start a small local server:

```
python -m http.server 8000 --directory public
```

or `npx serve public`, then open `http://localhost:8000`. Chrome AI works on `localhost`.

### Chrome AI
Needs desktop Chrome with the Prompt API. The model is about 4 GB and Chrome needs about
  20 GB of free disk space to download it.
Chrome downloads the model quietly in the background. See its state at `chrome://on-device-internals`.
A page cannot delete the model. To remove it: Chrome Settings → System → On-device AI.

### AI server
The server must allow calls from the game's address (CORS):

Ollama: set `OLLAMA_ORIGINS` to the game's address before starting
  (e.g. `https://sandboxed.martocierny.workers.dev`). Server address: `http://localhost:11434/v1`.
LM Studio: start the server with CORS on, e.g. `lms server start --cors`.
  Server address: `http://localhost:1234/v1`.

Chrome may ask whether the page can access devices on your local network.

API keys stay in the player's browser only.

### Deployment
Cloudflare Pages connected to this repository: framework preset None, build command empty,
build output directory `public`. Every push to `main` deploys the site; every other branch gets
its own preview address.

## Project structure

```
public/              ← exactly what Cloudflare Pages serves
  index.html
  style.css
  js/
    main.js          screens (start, host, sandbox), AI check and the Create button
    room.js          the sandbox the player is in: name, rules, players
    ai.js            askAI(messages, schema): the one place every AI call goes through
    ai-chrome.js     Chrome AI (Prompt API)
    ai-webllm.js     model in the browser (WebLLM, WebGPU)
    ai-server.js     AI server with the OpenAI API: Ollama, LM Studio
    prompts.js       what we ask the AI: schemas, rules, examples, a second try on errors
    sketch.js        Sketch-RNN: an AI that sketches stroke by stroke
    validate.js      the rules for objects (later used by the other players too)
    script.js        the text of an object script
    look.js          drawing the look
    behavior.js      movement in the world (ground, gravity, the top area) and effects
    actions.js       reactions and actions on other objects: explode, damage, shoot, spawn, touch
    particles.js     effect particles (sparkles, smoke, fire, bubbles…) and explosions
    sandbox.js       the world, camera (drag to look around), objects, selection, dragging
    workbench.js     the workbench: a new object with preview and script before it goes into the world
    pad.js           your own drawing
  lib/               Sketch-RNN library (copy, see lib/NOTICE.txt)
```

## Design notes

### Objects
An object has a look and a behavior. The AI creates them separately, in two calls,
  and they are joined into one script.
Look: an icon (Twemoji, the same for everyone), an AI sketch (Sketch-RNN), shapes,
  or your own drawing.
AI sketch: the language AI picks a thing (out of 106 categories) and a color from the prompt, and
  Sketch-RNN draws it. The result is strokes – the same as your own drawing, with the same validation.
  The library (1.1 MB) and models (~3 MB each) load only on first use. The library is a copy in `lib/`;
  the models load straight from Google's server (`storage.googleapis.com/quickdraw-models`).
  In the sandbox the sketch is drawn stroke by stroke in about a second.

### Behavior
Only ready-made actions with values, never custom code:

Properties: `health` (how much damage it takes, default 3), `unbreakable`, `solid` (others can't pass
  through), `tags` (groups, e.g. `animal`).
move (one): none, wander, bounce, orbit, float, jump, follow (follows the mouse), patrol, fly.
  Optional `area: "top"` (stays in the sky).
effects (up to 3): spin, pulse, wobble, shake, squash, blink, fade, glow, rainbow, and particles
  sparkles, smoke, fire, bubbles, hearts, snow, trail. They can have a speed and a color.
reactions (up to 3): when (click, touch, wall, timer, hurt, destroyed) and what:
   on itself: jump, spin, grow, burst, say (one emoji), hide,
   on others: explode (radius, damage), damage, destroy, push (target self / other / near),
    shoot (at the nearest, or left, right, up, down), spawn (a new object from one emoji).
 The same reaction can't fire again within half a second.
 A destroyed object leaves at the end of the frame and its `destroyed` reaction still runs, so bombs
  explode in a chain, step by step – never in an endless loop.
 Limits: up to 5 shots per object and 60 per sandbox, a shot lives 3 s, up to 3 spawned objects per
  object, spawned objects have no reactions.
 Presets for the AI (traits): bomb, gun, vehicle, flying, animal, wall, plant, sky. The AI picks a
  preset, the code expands it into properties and reactions, and the player can see and change them in
  the script.
 Blinking at most 3 times a second (to protect people with epilepsy).
 Movement and effects are computed from time, so all players will see them the same way later.
  Particles are only decoration.
 No unwanted effects: the AI suggests a behavior, but the code keeps only what has a matching word in
  the prompt (e.g. `glow` ← glow, shine, bright; `flying` ← helicopter, plane, bird; a reaction needs a
  word for both when* and what). English words only for now.

### World and rules
 Side view: ground at the bottom, sky at the top, gravity. Everything runs by itself; the player
  doesn't control anything.
 The host sets the rules: gravity on / off, and what objects may destroy: all objects,
  only objects of the same player, or nothing. Every object has an author.
 Flying objects (orbit, float, follow, patrol, fly) or objects with `area: "top"` ignore gravity.

### AI choice
 The AI is the "brain" that understands text. The look ("the hand") is chosen separately.
 The player's choice is remembered: Chrome AI, Browser model (with a model size) or AI server.
 Browser models: Small = Qwen 2.5 1.5B, Medium = Llama 3.2 3B, Large = Qwen 2.5 7B. A model is downloaded
  once, stays in the browser and can be deleted. The library loads from a CDN only when picked.
 Validation checks only the JSON and doesn't depend on which AI made the object. The game stays fair –
  a better AI just makes nicer objects.

## License

The project's code is under the **MIT License** – see [LICENSE](LICENSE).

Third-party parts keep their own licenses:

- Icons: [Twemoji](https://github.com/jdecked/twemoji) by Twitter and contributors, CC-BY 4.0.
- [WebLLM](https://github.com/mlc-ai/web-llm): Apache 2.0.
- Browser models: Qwen 2.5 1.5B and 7B (Apache 2.0), Llama 3.2 3B (Llama 3.2 Community License,
  "Built with Llama"). Qwen 2.5 3B is left out because its license is for research only.
- Sketches: [Sketch-RNN](https://github.com/magenta/magenta-js/tree/main/sketch) by Google Magenta
  (Apache 2.0), trained on [Quick, Draw!](https://github.com/googlecreativelab/quickdraw-dataset) data
  (CC BY 4.0).
