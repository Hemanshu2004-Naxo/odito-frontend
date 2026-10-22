/**
 * Full Website Audit page geometry. The capture area uses the A4 aspect ratio
 * (210 x 297 mm) at 960 CSS px wide, so a captured page fills the PDF page
 * exactly. (It used to be 960x1280, i.e. 3:4, which left a ~17 mm blank band
 * at the bottom of every A4 page.)
 */
export const PAGE_WIDTH = 960;
export const PAGE_HEIGHT = 1357; // round(960 * 297 / 210)
