namespace SpiralMatrix {
    let scene = new Scene(<HTMLCanvasElement>document.querySelector("canvas"));
    scene.addRenderer(new AlignToWindowUtil(scene.getCanvas()));
    scene.addRenderer(new FpsRenderer(scene.getCanvas()));
}