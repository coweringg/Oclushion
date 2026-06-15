#ifndef GHOSTTY_H
#define GHOSTTY_H

#include <stddef.h>
#include <stdint.h>

typedef struct ghostty_config_s ghostty_config_s;
typedef struct ghostty_terminal_s ghostty_terminal_s;
typedef struct ghostty_surface_s ghostty_surface_s;

ghostty_config_s*   ghostty_config_new(void);
void                ghostty_config_free(ghostty_config_s*);
int                 ghostty_config_set(ghostty_config_s*, const char* key, const char* value);

ghostty_terminal_s* ghostty_terminal_new(const ghostty_config_s*);
void                ghostty_terminal_free(ghostty_terminal_s*);
int                 ghostty_terminal_inject(ghostty_terminal_s*, const char* data, size_t len);
int                 ghostty_terminal_read(ghostty_terminal_s*, char* buf, size_t cap);
void                ghostty_terminal_resize(ghostty_terminal_s*, uint32_t cols, uint32_t rows);
int                 ghostty_terminal_render(ghostty_terminal_s*, uint64_t surface_id);

ghostty_surface_s*  ghostty_surface_new(ghostty_terminal_s*, uint32_t width, uint32_t height, double scale);
void                ghostty_surface_free(ghostty_surface_s*);
uint64_t            ghostty_surface_id(ghostty_surface_s*);

const char*         ghostty_version(void);

#endif /* GHOSTTY_H */
