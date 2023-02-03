#include <cstdarg>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <ostream>
#include <new>


namespace glass_easel_template_compiler {

struct StrRef {
  uint8_t *buf;
  size_t len;
};

struct StrRefArray {
  StrRef *buf;
  size_t len;
};

struct TmplParseResult {
  bool success;
  StrRef message;
  size_t start_row;
  size_t start_col;
  size_t end_row;
  size_t end_col;
};

struct TmplGroup {
  void *inner;
};


extern "C" {

void str_ref_array_free(StrRefArray self);

void str_ref_free(StrRef self);

TmplParseResult tmpl_group_add_tmpl(TmplGroup *self,
                                    const uint8_t *path_buf,
                                    size_t path_len,
                                    const uint8_t *content_buf,
                                    size_t content_len);

void tmpl_group_free(TmplGroup self);

StrRefArray tmpl_group_get_direct_dependencies(const TmplGroup *self,
                                               const uint8_t *path_buf,
                                               size_t path_len);

StrRef tmpl_group_get_runtime_string(const TmplGroup *self);

StrRef tmpl_group_get_tmpl_gen_object(const TmplGroup *self,
                                      const uint8_t *path_buf,
                                      size_t path_len);

StrRef tmpl_group_get_tmpl_gen_object_groups(const TmplGroup *self);

TmplGroup tmpl_group_new();

void tmpl_parser_result_free(TmplParseResult self);

} // extern "C"

} // namespace glass_easel_template_compiler
