namespace SpiralMatrix {
    function unwrapNull<T>(v: T | null | undefined) {
        if (v === null || v === undefined) {
            throw new Error("value should never be null.");
        } else {
            return v;
        }
    }

    enum MazeType {
        Empty,
        Born,
        Dist,
        Block,
        OutOfBound
    }

    class MazeInput {
        static ArrayTypeMap = <{ [key: string]: MazeType }>{
            " ": MazeType.Empty,
            "*": MazeType.Block,
            "+": MazeType.Born,
            "O": MazeType.Dist
        };

        get width() {
            return this.array[0].length;
        }

        get height() {
            return this.array.length;
        }

        born() {
            return this.findSpecificPoint(MazeType.Born);
        }

        dist() {
            return this.findSpecificPoint(MazeType.Dist);
        }

        findSpecificPoint(type: MazeType) {
            for (let x = 0; x < this.width; ++x) {
                for (let y = 0; y < this.height; ++y) {
                    if (this.at(x, y) === type) {
                        return new Vector2(x, y);
                    }
                }
            }
            throw new Error("No Born Position Found.");
        }

        at(x: number, y: number) {
            if (0 <= x && x < this.width &&
                0 <= y && y < this.height) {
                return MazeInput.ArrayTypeMap[this.array[y][x]];
            } else {
                return MazeType.OutOfBound
            }
        }

        constructor(private readonly array: string[]) {
        }

        static createDefault() {
            let array = [
                "+                   ",
                "    * *****         ",
                "    *               ",
                "   **               ", 
                "    *               ",
                "    *     *         ",
                "          *         ",
                "    *     *         ",
                "    *     *  *      ",
                "    *     *  *****  ",
                "    *     *  *      ",
                "***       *  *      ",
                "    *        *      ",
                " **********  *  ****",
                "          *  *      ",
                "             *      ",
                "        ******      ",
                "                    ",
                "        *           ",
                "        *          O"
            ];
            return new MazeInput(array);
        }
    }

    class MazeVisitItem {
        constructor(
            public readonly step: number,
            public readonly p: Vector2,
            public readonly from: MazeVisitItem | null) {
        }

        static createBorn(p: Vector2) {
            return new MazeVisitItem(0, p, null);
        }
    }

    class Vector2 {
        constructor(public readonly x: number, public readonly y: number) {
        }

        by(p: Vector2) {
            return new Vector2(this.x + p.x, this.y + p.y);
        }

        equals(p: Vector2) {
            return (this.x === p.x) && (this.y === p.y);
        }
    }

    class TravelBlock extends Vector2 {
        blocks(): Vector2[] {
            return [];
        }
    }

    class HourseBlocks extends TravelBlock {
        blocks() {
            let m = Math.abs(this.x) > Math.abs(this.y) ? this.x : this.y;
            if (m === this.x) {
                return [new Vector2(m / 2, 0)];
            } else {
                return [new Vector2(0, m / 2)];
            }
        }
    }

    class MazeTravelContext {
        visitArray: Array<MazeVisitItem | null>[];
        availablePoints: MazeVisitItem[];
        onNoResult = new PromiseEventVoid();
        onComplete = new PromiseEvent<MazeVisitItem[]>();

        private newAvailabelPoint(v: MazeVisitItem) {
            this.visitArray[v.p.y][v.p.x] = v;
            this.availablePoints.push(v);
        }

        private isPositionOk(from: Vector2, travel: TravelBlock) {
            let okTypes = [MazeType.Empty, MazeType.Dist];

            for (let p of travel.blocks()) {
                let block = from.by(p);
                if (this.input.at(block.x, block.y) === MazeType.OutOfBound) {
                    return false;
                } else if (okTypes.indexOf(this.input.at(block.x, block.y)) === -1) {
                    return false;
                }
            }

            let to = from.by(travel);
            if (this.input.at(to.x, to.y) === MazeType.OutOfBound) {
                return false;
            } else if (this.visitArray[to.y][to.x] !== null) {
                return false;
            } else if (okTypes.indexOf(this.input.at(to.x, to.y)) === -1) {
                return false;
            } else {
                return true;
            }
        }

        private generateResult() {
            let result = Array<MazeVisitItem>();

            for (
                let p = <MazeVisitItem | null>this.availablePoints[this.availablePoints.length - 1];
                p !== null;
                p = p.from
            ) {
                result.unshift(p);
            }

            return result;
        }

        private travelOneLevel(travelFrom: number) {
            let allLength = this.availablePoints.length;
            let availabelPointCount = allLength - travelFrom;
            if (availabelPointCount === 0) {
                this.onNoResult.fire();
                return;
            }

            let dist = this.input.dist();
            for (let i = travelFrom; i < this.availablePoints.length; ++i) {
                let from = this.availablePoints[i];

                for (let travelItem of this.travels) {
                    if (this.isPositionOk(from.p, travelItem)) {
                        let to = from.p.by(travelItem);
                        this.newAvailabelPoint(new MazeVisitItem(from.step + 1, to, from));
                        if (to.equals(dist)) {
                            this.onComplete.fire(this.generateResult());
                            return;
                        }
                    }
                }
            }

            this.travelOneLevel(allLength);
        }

        travel() {
            function arr(n: number) {
                return <Array<any>>Array.apply(null, { length: n });
            }

            this.visitArray =
                arr(this.input.height).map(() =>
                    arr(this.input.width).map(() => <MazeVisitItem | null>null));

            this.availablePoints = [];
            this.newAvailabelPoint(MazeVisitItem.createBorn(this.input.born()));

            this.travelOneLevel(0);
        }

        constructor(
            private readonly input: MazeInput,
            private readonly travels: TravelBlock[]) {
        }

        static travel(input: MazeInput, travels: TravelBlock[]) {
            let ctx = new MazeTravelContext(input, travels);
            let defer = $.Deferred<MazeVisitItem[]>();

            ctx.onComplete.connect(v => defer.resolve(v));
            ctx.onNoResult.connect(() => defer.reject());
            ctx.travel();

            return defer.promise();
        }
    }

    class MazeSystem {
        input = MazeInput.createDefault();
        travels = [
            new HourseBlocks(2, 1),
            new HourseBlocks(2, -1),
            new HourseBlocks(1, 2),
            new HourseBlocks(1, -2),
            new HourseBlocks(-2, 1),
            new HourseBlocks(-2, -1),
            new HourseBlocks(-1, 2),
            new HourseBlocks(-1, -2),
            //new Vector2(1, 0),
            //new Vector2(0, 1),
            //new Vector2(-1, 0),
            //new Vector2(0, -1),
            //new Vector2(-1, -1),
            //new Vector2(1, 1),
        ];
        result: MazeVisitItem[];

        constructor() {
            MazeTravelContext.travel(this.input, this.travels)
                .then(data => this.result = unwrapNull(data));
        }
    }

    class MazeRenderer extends RendererBase {
        system = new MazeSystem();

        edgeLength() {
            let edgeCount = Math.max(this.system.input.width, this.system.input.height);
            return this.size() / edgeCount;
        }

        size() {
            return Math.min(this.canvas.width(), this.canvas.height()) - 15;
        }

        render(time: number) {
            this.canvas.setTransform(this.centerTransform());
            this.drawGrid();
            this.drawMaze();
            this.drawDirection();
        }

        sx = (v: number) => this.edgeLength() * (v - this.system.input.width / 2);
        sy = (v: number) => this.edgeLength() * (v - this.system.input.height / 2);

        drawDirection() {
            let sx = this.sx;
            let sy = this.sy;

            if (this.system.result) {
                this.canvas.beginPath();
                for (let i = 0; i < this.system.result.length; ++i) {
                    let p = this.system.result[i];
                    let np = this.system.result[i + 1];

                    if (np) {
                        this.canvas.drawLine(sx(p.p.x + 0.5), sy(p.p.y + 0.5), sx(np.p.x + 0.5), sy(np.p.y + 0.5), "pink", 5);
                    }
                }
            }
        }

        drawMaze() {
            let sx = this.sx;
            let sy = this.sy;

            for (let x = 0; x < this.system.input.width; ++x) {
                for (let y = 0; y < this.system.input.height; ++y) {
                    let type = this.system.input.at(x, y);
                    switch (type) {
                        case MazeType.Block:
                            this.canvas.fillRect(sx(x), sy(y), this.edgeLength(), this.edgeLength(), "red");
                            break;
                        case MazeType.Born:
                            this.canvas.fillRect(sx(x), sy(y), this.edgeLength(), this.edgeLength(), "blue");
                            break;
                        case MazeType.Dist:
                            this.canvas.fillRect(sx(x), sy(y), this.edgeLength(), this.edgeLength(), "yellow");
                            break;
                        default:
                            break;
                    }
                }
            }
        }

        drawGrid() {
            let sx = this.sx;
            let sy = this.sy;

            this.canvas.beginPath();
            for (let i = 0; i <= this.system.input.width; ++i) {
                this.canvas.line(sx(i), sy(0), sx(i), sy(this.system.input.height));
            }
            for (let i = 0; i <= this.system.input.height; ++i) {
                this.canvas.line(sx(0), sy(i), sx(this.system.input.width), sy(i));
            }
            this.canvas.stroke("black", 1);
        }

        constructor(canvas: CanvasManager) {
            super(canvas);
            console.log(this);
        }
    }

    let scene = new Scene(<HTMLCanvasElement>document.querySelector("canvas"));
    scene.addRenderer(new AlignToWindowUtil(scene.getCanvas()));
    scene.addRenderer(new FpsRenderer(scene.getCanvas()));
    scene.addRenderer(new MazeRenderer(scene.getCanvas()));
};