// Optional maintainer probe; no game runtime, account or game asset is loaded.
// Download the pinned stb_image.h beside this file or add its directory via -I.
#define STB_IMAGE_IMPLEMENTATION
#define STBI_ONLY_PNG
#include "stb_image.h"
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
  if (argc != 2) return 2;
  FILE *file = fopen(argv[1], "rb");
  if (!file) return 3;
  fseek(file, 0, SEEK_END);
  long size = ftell(file);
  rewind(file);
  if (size <= 0 || size > 1048576) { fclose(file); return 4; }
  unsigned char *bytes = malloc(size);
  if (!bytes || fread(bytes, 1, size, file) != (size_t)size) {
    free(bytes); fclose(file); return 5;
  }
  fclose(file);
  int width, height, components;
  unsigned char *pixels = stbi_load_from_memory(bytes, (int)size, &width, &height, &components, 4);
  free(bytes);
  if (!pixels) { fprintf(stderr, "%s\n", stbi_failure_reason()); return 6; }
  int center = ((height / 2) * width + width / 2) * 4;
  printf("%dx%d center=%u,%u,%u,%u corner-alpha=%u\n", width, height,
    pixels[center], pixels[center + 1], pixels[center + 2], pixels[center + 3], pixels[3]);
  int matches = width == 64 && height == 64 && pixels[center] == 255 &&
    pixels[center + 1] == 0 && pixels[center + 2] == 0 && pixels[center + 3] == 128 && pixels[3] == 0;
  stbi_image_free(pixels);
  return matches ? 0 : 1;
}
