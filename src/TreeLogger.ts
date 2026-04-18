export class TreeLogger {
    private padding: number = 0;

    constructor(padding: number = 0) {
        this.padding = padding;
    }

    log(message: string) {
        console.log(" ".repeat(this.padding) + message.replace(/\n/g, "\n" + " ".repeat(this.padding)));
    }

    createChildLogger(increasePadding: number): TreeLogger {
        return new TreeLogger(this.padding + increasePadding);
    }
}
