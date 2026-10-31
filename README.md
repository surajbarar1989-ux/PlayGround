# PlayGround

## 🕷️ Spider-Man — Web Rush

A self-contained 3D web-swinging game that runs in any modern browser. No build step, no
external assets: the city, the character, textures, and sound are all generated at runtime
with [Three.js](https://threejs.org/) (vendored locally in `vendor/`).

### Play

```bash
python3 -m http.server 3000   # then open http://localhost:3000
```

Or run `./start.sh` if you are using the OMGithub runtime.

### Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move / steer swing | `W` `A` `S` `D` | left joystick |
| Jump | `Space` | `JUMP` |
| Shoot web / swing | hold `Space` in the air | hold `WEB` (auto-jumps off the ground) |
| Release web / boost | let go of `Space` | lift off `WEB` |
| Sprint | `Shift` | push the stick fully |
| Orbit camera | mouse (click to capture) | drag the screen |
| Zoom camera | mouse wheel | — |
| Respawn on nearest roof | `R` | — |
| Mute / unmute | `M` | ♪ button |
| Controls sheet | `?` button | `?` button |

### How it works

- Swing across a procedurally generated city and collect all **24 spider-tokens**.
- The web anchors to the nearest tower in front of you; hold forward to pump the arc and
  gain height. Releasing the web gives a launch boost.
- The run timer, top speed, and swing count are tracked, and the win screen lets you
  swing again instantly.
- Runs on desktop and touch devices with safe-area-aware HUD and a live radar.

### Project layout

```
index.html          UI, HUD, menus, touch controls
style.css           all styling and responsive/mobile rules
src/main.js         city generation, physics, character, audio, game loop
vendor/three.module.js   vendored Three.js r160
```

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/surajbarar1989-ux/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/surajbarar1989-ux/PlayGround)

- 🎮 [Open the project](https://omgithub.com/surajbarar1989-ux/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=surajbarar1989-ux%2FPlayGround).
- 💻 [Explore the source](https://github.com/surajbarar1989-ux/PlayGround).
- 🛠️ [Check build runs](https://github.com/surajbarar1989-ux/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/surajbarar1989-ux/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/surajbarar1989-ux).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->
