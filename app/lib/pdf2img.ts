export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) {
        console.log("PDF.js library already loaded");
        return pdfjsLib;
    }
    if (loadPromise) {
        console.log("PDF.js library is currently loading...");
        return loadPromise;
    }

    console.log("Loading PDF.js library...");
    isLoading = true;
    loadPromise = import("pdfjs-dist").then((lib) => {
        console.log("PDF.js library imported successfully");
        // Set the worker source to use local file
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        console.log("Worker source set to:", lib.GlobalWorkerOptions.workerSrc);
        pdfjsLib = lib;
        isLoading = false;
        return lib;
    }).catch((error) => {
        console.error("Failed to load PDF.js library:", error);
        isLoading = false;
        throw error;
    });

    return loadPromise;
}

export async function convertPdfToImage(
    file: File
): Promise<PdfConversionResult> {
    try {
        console.log("Starting PDF conversion for file:", file.name);
        
        const lib = await loadPdfJs();
        console.log("PDF.js library loaded successfully");

        const arrayBuffer = await file.arrayBuffer();
        console.log("File converted to array buffer, size:", arrayBuffer.byteLength);
        
        const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
        console.log("PDF document loaded, pages:", pdf.numPages);
        
        const page = await pdf.getPage(1);
        console.log("First page loaded");

        const viewport = page.getViewport({ scale: 4 });
        console.log("Viewport created:", viewport.width, "x", viewport.height);
        
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (context) {
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";
        }

        console.log("Starting page render...");
        await page.render({ canvasContext: context!, viewport }).promise;
        console.log("Page render completed");

        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        console.log("Image blob created successfully, size:", blob.size);
                        // Create a File from the blob with the same name as the pdf
                        const originalName = file.name.replace(/\.pdf$/i, "");
                        const imageFile = new File([blob], `${originalName}.png`, {
                            type: "image/png",
                        });

                        resolve({
                            imageUrl: URL.createObjectURL(blob),
                            file: imageFile,
                        });
                    } else {
                        console.error("Failed to create image blob");
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: "Failed to create image blob",
                        });
                    }
                },
                "image/png",
                1.0
            ); // Set quality to maximum (1.0)
        });
    } catch (err) {
        console.error("PDF conversion error:", err);
        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF: ${err}`,
        };
    }
}