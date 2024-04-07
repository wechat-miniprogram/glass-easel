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

struct TmplGroup {
  void *inner;
};

struct TmplParseWarning {
  StrRef message;
  uint32_t start_line;
  uint32_t start_col;
  uint32_t end_line;
  uint32_t end_col;
};

struct TmplParseWarningArray {
  TmplParseWarning *buf;
  size_t len;
};


extern "C" {

void str_ref_array_free(StrRefArray self);

void str_ref_free(StrRef self);

void tmpl_group_add_script(TmplGroup *self,
                           const uint8_t *path_buf,
                           size_t path_len,
                           const uint8_t *content_buf,
                           size_t content_len);

TmplParseWarningArray tmpl_group_add_tmpl(TmplGroup *self,
                                          const uint8_t *path_buf,
                                          size_t path_len,
                                          const uint8_t *content_buf,
                                          size_t content_len);

StrRef tmpl_group_export_all_scripts(const TmplGroup *self);

StrRef tmpl_group_export_globals(const TmplGroup *self);

void tmpl_group_free(TmplGroup self);

StrRefArray tmpl_group_get_direct_dependencies(const TmplGroup *self,
                                               const uint8_t *path_buf,
                                               size_t path_len);

StrRef tmpl_group_get_inline_script(const TmplGroup *self,
                                    const uint8_t *path_buf,
                                    size_t path_len,
                                    const uint8_t *module_name_buf,
                                    size_t module_name_len);

StrRefArray tmpl_group_get_inline_script_module_names(const TmplGroup *self,
                                                      const uint8_t *path_buf,
                                                      size_t path_len);

uint32_t tmpl_group_get_inline_script_start_line(const TmplGroup *self,
                                                 const uint8_t *path_buf,
                                                 size_t path_len,
                                                 const uint8_t *module_name_buf,
                                                 size_t module_name_len);

StrRef tmpl_group_get_runtime_string(const TmplGroup *self);

StrRef tmpl_group_get_runtime_var_list();

StrRefArray tmpl_group_get_script_dependencies(const TmplGroup *self,
                                               const uint8_t *path_buf,
                                               size_t path_len);

StrRef tmpl_group_get_tmpl_gen_object(const TmplGroup *self,
                                      const uint8_t *path_buf,
                                      size_t path_len);

StrRef tmpl_group_get_tmpl_gen_object_groups(const TmplGroup *self);

StrRef tmpl_group_get_wx_gen_object_groups(const TmplGroup *self);

TmplGroup tmpl_group_new();

void tmpl_group_set_extra_runtime_script(TmplGroup *self,
                                         const uint8_t *content_buf,
                                         size_t content_len);

int32_t tmpl_group_set_inline_script(TmplGroup *self,
                                     const uint8_t *path_buf,
                                     size_t path_len,
                                     const uint8_t *module_name_buf,
                                     size_t module_name_len,
                                     const uint8_t *content_buf,
                                     size_t content_len);

void tmpl_parse_warning_array_free(TmplParseWarningArray self);

void tmpl_parse_warning_free(TmplParseWarning self);

} // extern "C"

} // namespace glass_easel_template_compiler
