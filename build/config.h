/* Hand-written replacement for the autotools-generated config.h,
   so doom-wasm can be built with plain emcc on any OS (see build/build.mjs). */

#define PACKAGE_NAME "Doom no X"
#define PACKAGE_TARNAME "doom-no-x"
#define PACKAGE_VERSION "1.0.0"
#define PACKAGE_STRING "Doom no X 1.0.0"
#define PACKAGE_BUGREPORT ""
#define PROGRAM_PREFIX "doom-no-x-"

/* emscripten's libc provides these */
#define HAVE_DECL_STRCASECMP 1
#define HAVE_DECL_STRNCASECMP 1
#define HAVE_DIRENT_H 1
