export { default, alt, size, contentType, runtime } from "./opengraph-image";

// Les exports de configuration de route ne sont pas forcément repris via un
// simple re-export : on le redéclare explicitement ici (voir opengraph-image.tsx).
export const dynamic = "force-dynamic";
