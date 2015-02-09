define(['lodash', 'phaser', 'Layout', 'StateMachine'],
function(_, Phaser, Layout, StateMachine){
    "use strict";

    var global = window;
    var cur_objects = Object();
    var $1 = document.querySelector.bind(document), $s = document.querySelectorAll.bind(document);
    var screenModes = {
        'fool_full_screen': { background: 'fool', ratio: function(){ return window.screen.width / window.screen.height; }, full: 1 },
        'fool_4_3': { background: 'fool', ratio: function(){ return 4/3; } },
        'fool_16_9': { background: 'fool', ratio: function(){ return 16/9; } },
        'wise_full_screen': { background: 'wise', ratio: function(){ return window.screen.width / window.screen.height; }, full: 1 },
        'wise_4_3': { background: 'wise', ratio: function(){ return 4/3; } },
        'wise_16_9': { background: 'wise', ratio: function(){ return 16/9; } },
    };
    
    var parts = {
        "wise_doorpanel": "wisemanhouse_doorpanel_prelim.jpg",
        "wise_leftroof":  "wisemanhouse_leftroof_prelim.png",
        "wise_plank":     "wisemanhouse_plank_previs.jpg",
        "wise_rightroof": "wisemanhouse_rightroof_prelim.png",
    };

    // position an axis-aligned box relative to another axis-aligned box
    var alignBox = Layout.alignBox;

    // James' globals
    var inJames = false;
    var bricks;
    var instructionText;
    var raindrops;
    var brickCollisionGroup;
    var rainCollisionGroup;
    var baseCollisionGroup;
    var mouseBody;
    var mouseConstraint;
    var startButton;
    
    [
    //   element id, sprite, scale, existing elements to connect to, position relative to first connected element
        ["door", "wise_doorpanel", ["base"], []],
        ["wall", "wise_plank", ["door", "base"], []],
        ["leftroof", "wise_leftroof", ["door"], []],
        ["rightroof", "wise_rightroof", ["wall", "leftroof"], []]
    ];
    
    var game, logicState = new StateMachine("logicState", {});

    // Lock two bodies together in their current orientation.
    var lock = function(bodyA, bodyB, strength) {
        var dx = bodyB.body.x-bodyA.body.x, dy = bodyB.body.y-bodyA.body.y;
        // rotate bodyB into bodyA's reference frame
        // Radians, so use .rotation rather than .angle.
        var dtheta = bodyB.body.rotation-bodyA.body.rotation;
        var sin = Math.sin(dtheta), cos = -Math.cos(dtheta);
        var dx_ = dy * sin + dx * cos, dy_ = dy * cos - dx * sin;

        var constraint = game.physics.p2.createLockConstraint( bodyA, bodyB, [dx_, dy_], dtheta);

        var bodyA = constraint.bodyA, bodyB = constraint.bodyB;
        var dx_ = bodyB.position[0] - bodyA.position[0], dy_ = bodyB.position[1] - bodyA.position[1];
        constraint.breakDistance2 = (dx_*dx_ + dy_*dy_) * (1 + (strength || 3)/1000);
    };
    
    var loadBuildingChunk = function(basePosition, description) {
        // clean up any existing building or create a new one
        if (game.building) {
            game.building.removeAll(true);
        } else {
            // not sure whether we want to add to stage or world, so keeping the default for now
            game.building = game.add.group(undefined, 'building', false, true, Phaser.Physics.P2);
            game.building = game.add.physicsGroup(Phaser.Physics.P2, undefined, 'building', true);
        }

        var buildingPositions = { base: basePosition };
        description.forEach(function(piece) {
            var reference = reference = buildingPositions[piece.ref];
            var size;
            if (piece.frame)
                size = game.cache.getFrameByIndex(piece.key, piece.frame);
            else
                size = game.cache.getFrame(piece.key);
            if (!piece.align)
                piece.align = { ref: { x: 0, y: 0 }, obj: { x: 0, y: 100 } };
            var position = alignBox(reference, piece.align.ref, size, piece.align.obj);
            position.body = game.building.create(position.x, position.y, piece.key, piece.frame);
            buildingPositions[piece.id] = position;

            piece.lock.forEach(function(lockTarget) {
                lock(position.body, buildingPositions[lockTarget].body);
            });
        });
    };
    
    var buttonStyles = {
    // [key, overFrame, outFrame, downFrame, upFrame, textStyle]
        mainMenu: ['menubtn', 1, 0, 2, 3, { }],
    };

    global.logicState = logicState;

    logicState.addState('mainmenu', {
        onPreloadGame: function(game) {
            game.state.add('mainmenu', {
                create: function() {
                    var layout = Layout.add([
                        ['image', 'sky',    ['menubg'], { x: 50, y: 80 }, { x: 50, y: 80 } ],
                        ['solid', 'shade',  [game.width, game.height, { fill: [0,0,0,0.5] }], { x: 0, y: 0 } ],
                        ['text', 'welcome', ["Welcome to the Parable\nof the Wise and Foolish Builders!",
                                { font: "bold 36px 'Verdana'", fill: '#FFF', stroke: '#000', strokeThickness: 4, align: 'center' }
                            ], { x: 50, y: 0 }, { x: 50, y: '50px' } ],
                        ['button', 'build', ['mainMenu', "Let's build!"], { x: 50, y: 0 }, '^', { x: 50, y: "100%+20px" }],
                        ['button', 'joshdemow', ['mainMenu', "Wise Josh"], { x: 50, y: 0 }, '^', { x: 50, y: "100%+20px" }],
                        ['button', 'joshdemof', ['mainMenu', "Foolish Josh"], { x: 50, y: 0 }, '^', { x: 50, y: "100%+20px" }],
                    ]);
                    global.layout = layout;
                }
            });

            game.load.image('menubg', 'assets/backgrounds/sea-361802_1920.jpg');
            game.load.spritesheet('menubtn', 'assets/menu/button.png', 600, 100);
        },
        onEnter: function(prevState) {
            game.state.start('mainmenu');
        },
        onButton: function(which) {
            var fn = {
                joshdemow: function() { logicState.to('joshdemo', 'wise'); },
                joshdemof: function() { logicState.to('joshdemo', 'fool'); },
            }[which];
            if (fn)
                fn();
        },
    });

    logicState.addState('start', {
        onEnter: function(prevState, screenMode) {
            document.body.className = "game";
            var ratio = screenModes[screenMode].ratio();
            // Clamp the screen ratio for full-screen with odd resolutions.
            if (ratio < 4/3) ratio = 4/3;
            if (ratio > 16/9) ratio = 16/9;
            var width = 2048, height = width / ratio;
            game = new Phaser.Game(width, height, Phaser.AUTO, 'container', {
                preload: function() {
                    game.load.image('menubg', 'assets/backgrounds/sea-361802_1920.jpg');
                    game.load.spritesheet('menubtn', 'assets/menu/button.png', 600, 100);
                    logicState.invokeAll('onPreloadGame', game);
                },
                create: function() {
                    // scale input to use canvas pixels rather than screen pixels
                    game.scale.scaleMode = Phaser.ScaleManager.EXACT_FIT;

                    global.game = game;
                    Layout.world = game.world;
                    // We can't always create things at the right position because some things don't have a size until they are created.
                    // So create in three phases: construct at 0,0; move into position; add to group/world.
                    Layout.context = {
                        nothing: function(name, group, positioner, width, height) {
                            var obj = { width: width, height: height };
                            var pos = positioner(obj);
                            obj.x = pos.x;
                            obj.y = pos.y;
                            return obj;
                        },
                        button: function(name, group, positioner, style, text, textAlign, textAnchor) {
                            if (typeof style === 'string')
                                style = buttonStyles[style];
                            var obj = new Phaser.Button(game, 0, 0, style[0],
                                function(){ logicState.invoke('onButton', name); }, null,
                                style[1], style[2], style[3], style[4]);
                            if (text) {
                                var label = new Phaser.Text(game, 0, 0, text, style[5]);
                                var pos = Layout.alignBox(obj, textAnchor || { x: 50, y: 50 }, label, textAlign || { x: 50, y: 50 });
                                label.position.set(pos.x, pos.y);
                                obj.addChild(label);
                            }
                            var pos = positioner(obj);
                            obj.position.set(pos.x, pos.y);
                            return group.add(obj, true);
                        },
                        group: function(name, group, positioner, width, height) {
                            var obj = new Phaser.Group(game, null, name);
                            var pos = positioner({ width: width, height: height });
                            obj.position.set(pos.x, pos.y);
                            return group.add(group, true);
                        },
                        image: function(name, group, positioner, key, frame) {
                            var obj = new Phaser.Image(game, 0, 0, key, frame);
                            var pos = positioner(obj);
                            obj.position.set(pos.x, pos.y);
                            return group.add(obj, true);
                        },
                        solid: function(name, group, positioner, width, height, options) {
                            var texture = new Phaser.BitmapData(game, "texture_" + name, width, height);
                            if (options.fill)
                                texture.fill.apply(texture, options.fill);
                            return this.sprite(name, group, positioner, texture, undefined, options);
                        },
                        sprite: function(name, group, positioner, key, frame, options) {
                            var obj = new Phaser.Sprite(game, 0, 0, key, frame);
                            var scale = 1;
                            if (options.scale) {
                                scale = options.scale;
                                obj.width  *= options.scale;
                                obj.height *= options.scale;
                            }
                            if (options.body) {
                                game.physics.p2.enable(obj);
                                if (options.body.polygon) {
                                    obj.body.clearShapes();
                                    var poly = [], i, n = options.body.polygon.length;
                                    for (i = 0; i < n; i += 2) {
                                        var x = options.body.polygon[i+0], y = options.body.polygon[i+1];
                                        poly.push(scale * x - obj.width/2);
                                        poly.push(scale * y - obj.height/2);
                                    }
                                    obj.body.addPolygon({ skipSimpleCheck: 1 }, poly);
                                }
                                // Default to static because we probably won't add dynamic objects via layout.
                                if (options.body.kinematic) {
                                    // It doesn't move, but it does interact with other physics objects.
                                    obj.body.motionState = Phaser.Physics.P2.Body.KINEMATIC;
                                } else if (!options.body.dynamic) {
                                    // According to the docs you can set body.static/.dynamic to false to change state.
                                    // In practice, not so much.
                                    obj.body.motionState = Phaser.Physics.P2.Body.STATIC;
                                }
                            }
                            // TODO: account for rotation
                            var pos = positioner(obj);
                            if (options.body) {
                                obj.position.set(pos.x, pos.y);
                                obj.body.x = pos.x + obj.width/2;
                                obj.body.y = pos.y + obj.height/2;
                            } else {
                                obj.position.set(pos.x, pos.y);
                            }
                            obj.name = name;
                            return group.add(obj, true);
                        },
                        text: function(name, group, positioner, text, style) {
                            var obj = new Phaser.Text(game, 0, 0, text, style);
                            var pos = positioner(obj);
                            obj.position.set(pos.x, pos.y);
                            return group.add(obj, true);
                        },
                    };

                    logicState.invokeAll('onCreateGame', game);
                    logicState.to('mainmenu');
                },
            });
        },
    });

    logicState.addState('not joshdemo', {
    onEnter: function(prevState, screenMode) {
        document.body.className = "game";
        var ratio = screenModes[screenMode].ratio();
        // Clamp the screen ratio for full-screen with odd resolutions.
        if (ratio < 4/3) ratio = 4/3;
        if (ratio > 16/9) ratio = 16/9;
        var width = 2048, height = width / ratio;
        Layout.bounds = { x:0, y:0, width:width, height:height };

        var arrow, target, device;
        var scene = [];
        var removedConstraints = [];
        game = new Phaser.Game(width, height, Phaser.AUTO, 'container', {
            preload: function() {
                game.load.image('bg', 'assets/bg_' + screenModes[screenMode].background + '.jpg');
                game.load.image('arrow', 'assets/arrow.png');
                game.load.spritesheet('planks', 'assets/planks.jpg', 90, 600);
                _.forOwn(parts, function(file, key) {
                    game.load.image(key, 'assets/building/' + file);
                });
                game.load.image('rainbutton', 'assets/rainbutton.png');
                game.load.image('raindrop', 'assets/raindrop.png');
                game.load.spritesheet('raindrops', 'assets/raindrops.png', 15, 25);
                game.load.image('base', 'assets/platform.png');
                game.load.image('startbutton', 'assets/startbutton.png');
                game.load.image('wise_man_bg', 'assets/backgrounds/wise_man_BG_prelim.jpg');
                game.load.image('material1', 'assets/building/wisemanhouse_leftroof_prelim.png');
                game.load.image('material2', 'assets/building/wisemanhouse_rightroof_prelim.png');
                game.load.image('material3', 'assets/building/wisemanhouse_plank_previs.jpg');
                game.load.image('material4', 'assets/building/wisemanhouse_doorpanel_prelim.jpg');
                game.load.image('nextbutton', 'assets/nextbutton.png');
                game.load.image('morebutton', 'assets/morebutton.png');
                game.load.physics('physicsData', 'assets/physics/materials.json');
                game.load.image('tetrisblock1', 'assets/tetrisblock1.png');
            },
            create: function() {
                var size, pos, spr;

                game.physics.startSystem(Phaser.Physics.P2JS);
                // x, y, width, height, collide with left, right, top, bottom, setCollisionGroup
                game.physics.p2.setBounds(0, 0, width, height, true, true, false, true, false);
                game.physics.p2.gravity.y = 1000;
                game.physics.p2.gravity.x = 100;
                game.physics.p2.restitution = 0.8;
                game.physics.p2.friction = 1.1;

                // scale up the sky to fit as necessary
                size = game.cache.getFrame('bg');
                size = { width: size.width, height: size.height };
                if (width > size.width) {
                    size.height = size.height * width / size.width;
                    size.width = width;
                }
                if (height > size.height) {
                    size.width = size.width * height / size.height;
                    size.height = height;
                }
                // center the sky
                pos = alignBox(game.camera.view, { x: 50, y: 50 }, size, { x: 50, y: 50 });
                spr = game.add.image(pos.x, pos.y, 'bg');
                spr.width = size.width;
                spr.height = size.height;
                global.sky = spr;

                // throw it on the ground
                var platform = { x: 200, y: 1280, width: 800, height: 20 };
                // adjust for background position
                platform.y += (height - 1536) / 2;
                var groundBitmap = game.add.bitmapData(2048, 1);
                //groundBitmap.fill(0x00, 0x99, 0xCC, 1);
                var ground = game.add.sprite(0 + groundBitmap.width/2, platform.y + groundBitmap.height/2, groundBitmap);
                game.physics.p2.enable(ground);
                ground.body.motionState = Phaser.Physics.P2.Body.KINEMATIC;
                global.ground = ground;

                // house
                size = game.cache.getFrame('wise_doorpanel');
                // -50 because P2 positions sprites by their center
                pos = alignBox(platform, { x: 0, y: 0 }, size, { x: 0-50, y: 100-50 });
                spr = game.add.sprite(pos.x, pos.y, 'wise_doorpanel');
                spr.width = size.width;
                spr.height = size.height;
                game.physics.p2.enable(spr);
                scene.push([spr, spr.body.x, spr.body.y, spr.body.angle]);
                target = alignBox({ x: pos.x, y: pos.y, width: spr.height, height: spr.height }, { x: 50, y: 50 });
                var door = spr;

                pos.x += size.width / 2;
                size = game.cache.getFrame('wise_plank');
                pos.x += size.width / 2;
                spr = game.add.sprite(pos.x, pos.y, 'wise_plank');
                spr.width = size.width;
                spr.height = size.height;
                game.physics.p2.enable(spr);
                scene.push([spr, spr.body.x, spr.body.y, spr.body.angle]);
                var side = spr;
                
                pos.x -= 800;
                pos.y -= 590;
                size = game.cache.getFrame('wise_leftroof');
                spr = game.add.sprite(pos.x+size.width/2, pos.y+size.height/2, 'wise_leftroof');
                game.physics.p2.enable(spr);
                spr.body.clearShapes();
                var xerror = -size.width/2, yerror = -size.height/2;
                spr.body.addPolygon({ skipSimpleCheck: 1 }, [160+xerror,282+yerror, 495+xerror,282+yerror, 495+xerror,60+yerror, 160+xerror,250+yerror]);
                spr.body.debug = true;
                scene.push([spr, spr.body.x, spr.body.y, spr.body.angle]);
                var roofLeft = spr;
                global.roof = roofLeft;

                lock(door, ground, 10);
                lock(side, ground, 10);
                lock(door, side, 5);
                lock(roofLeft, door, 5);

                /*
                // planky
                size = game.cache.getFrameByIndex('planks', 0);
                size = { width: size.width, height: size.height };
                size.width *= 0.4;
                size.height *= 0.4;
                // -50 because P2 positions sprites by their center
                pos = alignBox(platform, { x: 25, y: 0 }, size, { x: 50-50, y: 100-50 });
                spr = game.add.sprite(pos.x, pos.y, 'planks', Math.random()*10|0);
                spr.width = size.width;
                spr.height = size.height;
                game.physics.p2.enable(spr);
                scene.push([spr, spr.body.x, spr.body.y, spr.body.angle]);
                target = alignBox({ x: pos.x, y: pos.y, width: spr.height, height: spr.height }, { x: 50, y: 50 });
                var leftWall = spr;

                pos.x += size.height - size.width;
                spr = game.add.sprite(pos.x, pos.y, 'planks', Math.random()*10|0);
                spr.width = size.width;
                spr.height = size.height;
                game.physics.p2.enable(spr);
                scene.push([spr, spr.body.x, spr.body.y, spr.body.angle]);
                var rightWall = spr;

                pos.x -= size.height/2 - size.width/2;
                pos.y -= size.height/2 + size.width/2;
                spr = game.add.sprite(pos.x, pos.y, 'planks', Math.random()*10|0);
                spr.width = size.width;
                spr.height = size.height;
                game.physics.p2.enable(spr);
                spr.body.x = pos.x;
                spr.body.y = pos.y;
                spr.body.angle = 90;
                scene.push([spr, spr.body.x, spr.body.y, spr.body.angle]);
                var ceiling = spr;

                lock(ceiling, leftWall, 5);
                lock(ceiling, rightWall, 5);
                */

                size = game.cache.getFrame('arrow');
                pos = alignBox(game.camera.view, { x: 90, y: 60 }, size, { x: 50, y: 50 });
                spr = game.add.sprite(pos.x, pos.y, 'arrow');
                spr.width *= 2;
                spr.height *= 2;
                game.physics.p2.enable(spr);
                arrow = spr.body;
                arrow.clearShapes();
                arrow.addPolygon({ skipSimpleCheck: 1 }, [ 1,25, 31,0, 29,15, 49,15, 49,35, 29,35, 31,50 ].map(function(x){return 2*x - spr.width/2}));
                arrow.angularVelocity = Math.random()*20 - 10;
                arrow.mass = 15;
                arrow.motionState = Phaser.Physics.P2.Body.STATIC;
                scene.push([spr, spr.body.x, spr.body.y, spr.body.angle]);

                // scale input to use canvas pixels rather than screen pixels
                game.input.scale.x = game.input.scale.y = width / game.canvas.offsetWidth;
                
                game.input.onUp.add(function(){
                    if (arrow.static) {
                        var angle = arrow.rotation; // radians
                        var tan = Math.tan(angle);
                        var dx = target.x - arrow.x, dy = target.y - arrow.y;
                        var t = Math.sqrt(2 * (dy - dx * tan) / game.physics.p2.gravity.y);
                        var vx = dx / t;
                        var vy = vx * tan;
                        arrow.velocity.x = vx * 1.31;
                        arrow.velocity.y = vy * 1.1;
                        arrow.motionState = Phaser.Physics.P2.Body.DYNAMIC;
                    }
                });

                // James' button
                instructionText = game.add.text(game.world.width/4, game.world.height/4, 'Welcome to the Parable\nof the Wise and Foolish Builders!', { fontSize: '32px', fill: '#FFF', align: "center" });
                startButton = game.add.button(game.world.width/4, game.world.height*3/4, 'startbutton', startGame, this);

                // Gather objects we wish to destroy later
                cur_objects.door = door;
                cur_objects.side = side;
                cur_objects.arrow = arrow;
                cur_objects.startButton = startButton;

            },
            update: function() {
                if (inJames) {
                    return;
                }
                var angle = (game.input.y * -75/height) + 60;
                if (arrow.static) {
                    arrow.angle = angle;
                } else {
                    var anyMoving = false;
                    game.world.forEachExists(function(obj){
                        if (obj.body && obj.body.velocity) {
                            if (Math.abs(obj.body.velocity.x) > 3 || Math.abs(obj.body.velocity.y) > 3)
                                anyMoving = true;
                        }
                    });
                    if (!anyMoving) {
                        for (i in scene) {
                            var entry = scene[i], obj = entry[0]
                            obj.reset(entry[1], entry[2]);
                            obj.body.angle = entry[3];
                        }
                        arrow.angularVelocity = Math.random()*20 - 10;
                        arrow.motionState = Phaser.Physics.P2.Body.STATIC;
                        for (i in removedConstraints) {
                            game.physics.p2.addConstraint(removedConstraints[i]);
                        }
                        removedConstraints = [];
                    } else {
                        var constraintsToRemove = [];
                        for (var i in game.physics.p2.world.constraints) {
                            var constraint = game.physics.p2.world.constraints[i];
                            if (constraint.breakDistance2) {
                                var bodyA = constraint.bodyA, bodyB = constraint.bodyB;
                                var dx = bodyB.position[0] - bodyA.position[0], dy = bodyB.position[1] - bodyA.position[1];
                                var distance2 = dx*dx + dy*dy;
                                if (distance2 > constraint.breakDistance2)
                                    constraintsToRemove.push(constraint);
                            }
                        }
                        for (i in constraintsToRemove) {
                            game.physics.p2.removeConstraint(constraintsToRemove[i]);
                            removedConstraints.push(constraintsToRemove[i]);
                        }
                        constraintsToRemove = [];
                    }
                }
            }
        });

        // make it globally visible for debugging
        logicState.game = game;
    }
    });

    logicState.addState('resolution-select', {
    onEnter: function() {
            var setUpPrestart = function(device) {
                var handler = function() {
                    if (this.id.substr(-11) === 'full_screen')
                        document.body[device.requestFullscreen]();
                    for (var mode in screenModes) {
                        var el = document.getElementById(mode);
                        if (el)
                            el.removeEventListener('click', handler);
                    }
                    logicState.to('start', this.id);
                };
                for (var mode in screenModes) {
                    var el = document.getElementById(mode);
                    if (el)
                        el.addEventListener('click', handler);
                }
                document.removeEventListener("readystatechange", onComplete);
            };

            // When the browser is done loading everything, take down the static loading text and get ready to start the game.
            var onComplete = function() {
                if (document.readyState === 'complete') {
                    document.removeEventListener('readystatechange', onComplete);
                    document.body.className = "prestart";
                    // Phaser.Device.whenReady(setUpPrestart);
                    setUpPrestart(Phaser.Device);
                }
            };
            document.addEventListener("readystatechange", onComplete);
            onComplete();
        }
    });

    // James' functions
    function startGame() {

	// Destroy all of Josh's stuff
	for (var object in cur_objects) {
	    cur_objects[object].destroy();
	}

	// Change physics so that placing objects is pretty easy
        game.physics.p2.gravity.y = 10000;
        game.physics.p2.gravity.x = 0;
        game.physics.p2.restitution = 0.2;
        game.physics.p2.friction = 10000;
	
	inJames = true;
	instructionText.visible = false;
	startButton.visible = false;
	create_wiseman_build();
    }
    
    // Create the wiseman building stage
    function create_wiseman_build() {
        var pos = alignBox(game.camera.view, { x: 50, y: 50 }, global.sky, { x: 50, y: 50 });
        var background = game.add.image(pos.x, pos.y, 'wise_man_bg');
        background.width = global.sky.width;
        background.height = global.sky.height;
        
        // P2 Physics already enabled by Josh's code
        // Collisions must be two-way: each collision group must be set to
        // collide with all other collision groups.  One-way collisions
        // don't happen.
        brickCollisionGroup = game.physics.p2.createCollisionGroup();
        rainCollisionGroup = game.physics.p2.createCollisionGroup();
        baseCollisionGroup = game.physics.p2.createCollisionGroup();

        //  This part is vital if you want the objects with their own collision groups to still collide with the world bounds
        //  (which we do) - what this does is adjust the bounds to use its own collision group.
        game.physics.p2.updateBoundsCollisionGroup();

        // Allow collision events
        game.physics.p2.setImpactEvents(true);

        // // FYI: Platform is roughly from (100, 1295) to (1100, 1295)
        // var platform = { x: 200, y: 1280, width: 800, height: 20 };
        // // adjust for background position
        // platform.y += (global.sky.height - 1536) / 2;
        // var baseBitmap = game.add.bitmapData(2048, 1);
        // baseBitmap.fill(0x00, 0x99, 0xCC, 1);
        // var base = game.add.sprite(0 + baseBitmap.width/2, platform.y + baseBitmap.height/2, baseBitmap);
        // game.physics.p2.enable(base);
        // base.body.static = true;
        // base.body.setCollisionGroup(baseCollisionGroup);
        // base.body.collides([brickCollisionGroup, rainCollisionGroup]);

        var base = game.add.sprite(0, game.world.height*7/10, 'base');
        // Ground sprite is 200 pixels wide, we want it to be 3/4 of the screen long
        var baseLength = 200;
        base.scale.setTo((3*game.world.width)/(4*baseLength), 1);
        game.physics.p2.enable(base);
        base.body.static = true;
        base.body.setCollisionGroup(baseCollisionGroup);
        base.body.collides([brickCollisionGroup, rainCollisionGroup]);

        // Create a selection bar on the right of building blocks
        // Two buttons at the bottom
        var moreButton = game.add.button(game.world.width-(71*2), game.world.height*5/6, 'morebutton', getMore, this);    
        var nextButton = game.add.button(game.world.width-71, game.world.height*5/6, 'nextbutton', goNext, this);
        // Sprites for the actual materials
        for (var i = 1; i <= 4; i++) {
                var material = "material" + i;
                var materialSprite = game.add.sprite(game.world.width-(72*2), game.world.height*5/6-100*i, material);
                materialSprite.name = material;
                materialSprite.scale.setTo(0.15, 0.15);
            materialSprite.inputEnabled = true;
            materialSprite.events.onInputDown.add(spawnMaterial, materialSprite);
        }

        // We don't actually create bricks until they click on one to create
        bricks = game.add.group(game.world, "bricks", false, true, Phaser.Physics.P2);
        
        raindrops = game.add.group(game.world, "raindrops", false, true, Phaser.Physics.P2);
        
        var rainButton = game.add.button(game.world.width/4, game.world.height*3/4, 'rainbutton', makeItRain, this);

        // create physics body for mouse which we will use for dragging clicked bodies
        mouseBody = new p2.Body();
        game.physics.p2.world.addBody(mouseBody);
        
        // attach pointer events for dragging
        game.input.onDown.add(click, this);
        game.input.onUp.add(release, this);
        game.input.addMoveCallback(move, this);
    }

    function makeItRain() {
        instructionText.setText("Now raining");
        // Create some raindrops
        for (var i = 0; i < 100; i++) {
            var drop = raindrops.create(0, 0, "raindrops");
            game.physics.p2.enable(drop);
            drop.animations.add('splash', [0, 1, 2, 3], 10, false);
                drop.body.setCollisionGroup(rainCollisionGroup);
                drop.body.collides([brickCollisionGroup, baseCollisionGroup], splash, this);
            drop.kill();
        }
        game.time.events.add(Phaser.Timer.SECOND * 1, dropRain, this);
    }

    function dropRain() {
        // Find a raindrop and drop it
        var drop = raindrops.getFirstDead();
        if (drop != null) {        
            drop.body.x = game.rnd.integerInRange(0, 100)*game.world.width/100;
            drop.body.y = 0;
            drop.revive();
            drop.frame = 0;
        }
        var varx = game.rnd.realInRange(0, 1);
        if (varx == 0) {
            varx = 0.000001;
        }
        var delay = varx;
        //instructionText.setText("Delay = " + delay);
        game.time.events.add(Phaser.Timer.SECOND * delay, dropRain, this);
    }

    function splash(raindrop, base, shape1, shape2) {
        raindrop.sprite.animations.play('splash', 15, false, true);
    }

    function click(pointer) {
        // Check if we hit a brick
        var brickbodies = [];
        for (var ii = 0; ii < bricks.length; ii++) {
            var brick = bricks.next();
            brickbodies[ii] = brick.body;
        }
        
        var hitbodies = game.physics.p2.hitTest(pointer.position, brickbodies);
        
        if (hitbodies.length)
        {
            var clickedBody = hitbodies[0].parent;
            pickUpBody(clickedBody, pointer);
            return;
        }
    }

    function pickUpBody(clickedBody, pointer) {
        clickedBody.sprite.alive = false;

        // p2 uses different coordinate system, so convert the pointer position to p2's coordinate system
        var physicsPos = [game.physics.p2.pxmi(pointer.position.x), game.physics.p2.pxmi(pointer.position.y)];
        var localPointInBody = [0, 0];
        // this function takes physicsPos and converts it to the body's local coordinate system
        clickedBody.toLocalFrame(localPointInBody, physicsPos);
        
        // use a revoluteContraint to attach mouseBody to the clicked body
        //mouseConstraint = this.game.physics.p2.createRevoluteConstraint(mouseBody, [0, 0], clickedBody, [game.physics.p2.mpxi(localPointInBody[0]), game.physics.p2.mpxi(localPointInBody[1]) ]);
        mouseConstraint = global.game.physics.p2.createLockConstraint(mouseBody, clickedBody);
        
    }

    function release() {
        // remove constraint from object's body
        if (mouseConstraint != undefined) {
            mouseConstraint.bodyB.parent.sprite.alive = true;
            game.physics.p2.removeConstraint(mouseConstraint);
        }
    }

    function move(pointer) {
        // p2 uses different coordinate system, so convert the pointer position to p2's coordinate system
        mouseBody.position[0] = game.physics.p2.pxmi(pointer.position.x);
        mouseBody.position[1] = game.physics.p2.pxmi(pointer.position.y);
    }

    function goNext() {
    }

    function getMore() {
    }

    function spawnMaterial() {
	var brick = this.name;
	var brickSprite = bricks.create(game.input.activePointer.x, game.input.activePointer.y, brick);
	brickSprite.name = brick;
	// The physics body will not scale with the sprite, so scaling is not useful with physics data
	//brickSprite.scale.setTo(0.25, 0.25);
	brickSprite.inputEnabled = true;
	brickSprite.input.useHandCursor = true;
	// Doesn't work with p2, we have to enable drag in a different way
	//brickSprite.input.enableDrag();
	game.physics.p2.enable(brickSprite);
	// Unnecessary, since this is what it does by default
	//brickSprite.body.setRectangleFromSprite();
	if ( brickSprite.name == "material1" || brickSprite.name == "material2" ) {
	    brickSprite.body.clearShapes();
	    brickSprite.body.loadPolygon('physicsData', brickSprite.name);
	}
	brickSprite.body.setCollisionGroup(brickCollisionGroup);
	brickSprite.body.collides([brickCollisionGroup, baseCollisionGroup, rainCollisionGroup]);
	// Don't allow rotation
	brickSprite.body.fixedRotation = true;
	pickUpBody(brickSprite.body, game.input.activePointer);
	// Try and make these things a little more realistic
	// brickSprite.body.damping = 0.9;
	brickSprite.body.mass = 1000;
    }

    return logicState;
});
