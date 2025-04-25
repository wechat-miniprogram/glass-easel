use super::tag::{Element, ElementKind, Node};

macro_rules! iter {
    ($t:ident, $($mut_t:tt)*) => {
        pub struct $t<'a> {
            parent: &'a $($mut_t)* Element,
            cur: usize,
            cur_branch: usize,
        }

        impl<'a> $t<'a> {
            pub(super) fn new(parent: &'a $($mut_t)* Element) -> Self {
                Self {
                    parent,
                    cur: 0,
                    cur_branch: 0,
                }
            }
        }

        impl<'a> Iterator for $t<'a> {
            type Item = &'a $($mut_t)* Node;

            fn next(&mut self) -> Option<Self::Item> {
                match & $($mut_t)* self.parent.kind {
                    ElementKind::Normal { children, .. }
                    | ElementKind::Pure { children, .. }
                    | ElementKind::For { children, .. } => {
                        let ret = children.get(self.cur).map(|x| x as *const _);
                        if let Some(ret) = ret {
                            self.cur += 1;
                            // it is safe because the iterator never returns an item twice
                            Some(unsafe { & $($mut_t)* *(ret as *mut _) })
                        } else {
                            None
                        }
                    }
                    ElementKind::If {
                        branches,
                        else_branch,
                    } => {
                        let ret = loop {
                            if self.cur_branch >= branches.len() {
                                if let Some((_, children)) = else_branch {
                                    let ret = children.get(self.cur).map(|x| x as *const _);
                                    if ret.is_some() {
                                        self.cur += 1;
                                    }
                                    break ret;
                                }
                                break None;
                            }
                            let (_, _, children) = unsafe { branches.get_unchecked(self.cur_branch) };
                            let ret = children.get(self.cur).map(|x| x as *const _);
                            if let Some(ret) = ret {
                                self.cur += 1;
                                break Some(ret);
                            }
                            self.cur_branch += 1;
                            self.cur = 0;
                        };
                        // it is safe because the iterator never returns an item twice
                        ret.map(|ret| unsafe { & $($mut_t)* *(ret as *mut _) })
                    }
                    ElementKind::TemplateRef { .. }
                    | ElementKind::Include { .. }
                    | ElementKind::Slot { .. } => None,
                }
            }

            fn size_hint(&self) -> (usize, Option<usize>) {
                let count = match &self.parent.kind {
                    ElementKind::Normal { children, .. }
                    | ElementKind::Pure { children, .. }
                    | ElementKind::For { children, .. } => children.len(),
                    ElementKind::If {
                        branches,
                        else_branch,
                    } => {
                        branches.iter().map(|x| x.2.len()).sum::<usize>()
                            + else_branch.iter().map(|x| x.1.len()).sum::<usize>()
                    }
                    ElementKind::TemplateRef { .. }
                    | ElementKind::Include { .. }
                    | ElementKind::Slot { .. } => 0,
                };
                (count, Some(count))
            }
        }
    };
}

iter!(ChildrenIter,);
iter!(ChildrenIterMut, mut);

#[cfg(test)]
mod test {
    use crate::parse::tag::{Node, Value};

    #[test]
    fn iter_children() {
        const SRC: &'static str = r#"
            <div>
                <div>A</div>
                <block wx:for="123">B</block>
                <block wx:if="1">C</block>
                <block wx:elif="2">D</block>
                <block wx:elif="3">E</block>
                <block>F</block>
            </div>
        "#;
        let (mut template, _) = crate::parse::parse("TEST", SRC);
        fn rec(node: &mut Node, visited: &mut String) {
            if let Node::Text(v) = node {
                let Value::Static { value, .. } = v else {
                    unreachable!()
                };
                visited.push_str(&value);
                *value = "".into();
            }
            if let Node::Element(elem) = node {
                for child in elem.iter_children_mut() {
                    rec(child, visited);
                }
            }
        }
        let mut visited = String::new();
        for node in &mut template.content {
            rec(node, &mut visited);
        }
        assert_eq!(visited, "ABCDEF");
        let mut visited = String::new();
        for node in &mut template.content {
            rec(node, &mut visited);
        }
        assert_eq!(visited, "");
    }
}
