import { Button, Container } from '@mantine/core';
import { Outlet } from 'react-router-dom';
import { Brand } from '../shared/ui/Brand';
import styles from './PublicLayout.module.css';

export default function PublicLayout() {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Container size={1120} className={styles.headerInner}>
          <Brand />
          <Button component="a" href="/book" variant="light" size="sm">
            Выбрать время
          </Button>
        </Container>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
